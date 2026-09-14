import Box3D from "box3d-wasm/standard";
import { Quaternion, Vector3 } from "three";
import { createFlightPath } from "./flight-path.js";
import { createManualFlight, STEERING_KEYS } from "./manual-flight.js";

const vec = (a) => ({ x: a[0], y: a[1], z: a[2] });
const identity = { x: 0, y: 0, z: 0, w: 1 };
const zero = { x: 0, y: 0, z: 0 };
const FLOOR = 1,
  HEAD = 2,
  FEET = 4,
  BODY = 8;
export async function createSimulation(manifest) {
  const b3 = await Box3D();
  const world = new b3.World({
    gravity: { x: 0, y: -9.81, z: 0 },
    enableSleep: true,
  });
  const ground = world.createBody({
    type: "static",
    position: { x: 0, y: -0.25, z: 0 },
  });
  // Tile the floor so a swoop or toss beyond the original display circle still lands.
  for (const x of [-48, 0, 48])
    for (const z of [-48, 0, 48]) {
      ground
        .createBox({
          halfExtents: { x: 24, y: 0.25, z: 24 },
          offset: { x, y: 0, z },
          friction: 0.7,
          restitution: 0.22,
          userData: 1,
          filter: { categoryBits: FLOOR, maskBits: HEAD | BODY },
        })
        .delete();
    }
  const bodies = manifest.parts.map((part, index) => {
    const body = world.createBody({
      type: "dynamic",
      position: vec(part.center),
      linearDamping: 0.8,
      angularDamping: 3,
    });
    body
      .createHull({
        points: part.hull.map(vec),
        maxVertices: 32,
        density: 0.65,
        friction: 0.6,
        restitution: 0.28,
        enableHitEvents: true,
        userData: 100 + index,
        filter: {
          categoryBits: BODY,
          maskBits: FLOOR,
        },
      })
      .delete();
    for (const points of part.headContactHulls ?? []) {
      body
        .createHull({
          points: points.map(vec),
          maxVertices: 32,
          density: 0,
          friction: 0.25,
          restitution: 0,
          filter: { categoryBits: HEAD, maskBits: FEET },
        })
        .delete();
    }
    // These massless proxies collide only with the head. The full section
    // hull still handles the floor, and the printed neck socket stays free.
    for (const [side, points] of (part.footHulls ?? []).entries()) {
      body
        .createHull({
          points: points.map(vec),
          maxVertices: 32,
          density: 0,
          friction: 0.25,
          restitution: 0,
          userData: 200 + index * 100 + side,
          filter: { categoryBits: FEET, maskBits: HEAD },
        })
        .delete();
    }
    return body;
  });
  const joints = manifest.anchors.map((anchor, i) =>
    world.createSphericalJoint(bodies[i], bodies[i + 1], {
      anchorA: vec(anchor.map((v, j) => v - manifest.parts[i].center[j])),
      anchorB: vec(anchor.map((v, j) => v - manifest.parts[i + 1].center[j])),
      // Box3D twists around joint Z: align neck Z with up for symmetric yaw.
      localFrameA:
        i === 0
          ? {
              rotation: new Quaternion().setFromAxisAngle(
                new Vector3(1, 0, 0),
                -Math.PI / 2,
              ),
            }
          : {},
      localFrameB:
        i === 0
          ? {
              rotation: new Quaternion().setFromAxisAngle(
                new Vector3(1, 0, 0),
                -Math.PI / 2,
              ),
            }
          : {},
      enableSpring: true,
      hertz: 3,
      dampingRatio: 1,
      enableConeLimit: true,
      coneAngle: i === 0 ? 1.15 : 0.55,
      enableTwistLimit: true,
      lowerTwistAngle: i === 0 ? -1.2 : -0.4,
      upperTwistAngle: i === 0 ? 1.2 : 0.4,
      // Adjacent head/shoulders may contact through their foot proxies only.
      collideConnected: i === 0,
    }),
  );
  let mode = "rest",
    flightPath = null,
    flightState = null,
    manualFlight = null,
    manualIdle = 0;
  const dq = new Quaternion();
  let attitudeHistory = [];
  let impact = null,
    impactSequence = 0,
    simulationTime = 0,
    lastImpactTime = -Infinity;
  // Uncurl the printed tail's rest pose in flight, using soft joint springs.
  const tailAngles = [
    0,
    0,
    0,
    0,
    ...[4, 5, 6].map((i) => {
      const from = new Vector3(...manifest.anchors[i - 1]);
      const to =
        i < 6
          ? new Vector3(...manifest.anchors[i])
          : new Vector3(...manifest.parts[i].center);
      const direction = to.sub(from);
      return Math.atan2(direction.z, direction.x);
    }),
  ];
  function configureFlight(active) {
    bodies.forEach((body, i) => {
      body.setLinearDamping(active ? 0.18 : 0.8);
      body.setAngularDamping(active ? 0.8 : 3);
      body.setGravityScale(active && i > 0 ? 0.18 : 1);
    });
    joints.forEach((joint, i) => {
      // A softer neck lets the head turn before the shoulders catch up.
      joint.setSpringHertz(
        i === 0 ? (active ? 0.8 : 3) : active ? (i === 1 ? 2 : 1.5) : 3,
      );
      joint.setSpringDampingRatio(1);
      joint.setConeLimit(i === 0 ? 1.15 : active && i >= 3 ? 1.35 : 0.55);
      joint.setTwistLimits(
        i === 0 ? -1.2 : active ? -0.85 : -0.4,
        i === 0 ? 1.2 : active ? 0.85 : 0.4,
      );
      joint.setTargetRotation(
        active
          ? new Quaternion().setFromAxisAngle(
              new Vector3(0, 1, 0),
              tailAngles[i + 1] - tailAngles[i],
            )
          : identity,
      );
    });
  }
  let grab = null;
  const totalMass = bodies.reduce((sum, body) => sum + body.getMass(), 0);
  function endGrab() {
    if (!grab) return;
    grab.joint.destroy(true);
    grab.joint.delete();
    grab.handle.destroy();
    grab.handle.delete();
    grab = null;
    mode = "drop";
  }
  function beginGrab(index, point) {
    if (!bodies[index]) throw new RangeError("Unknown dragon section");
    endGrab();
    setMode("grab");
    const body = bodies[index];
    const localPoint = new Vector3()
      .copy(point)
      .sub(new Vector3().copy(body.getPosition()))
      .applyQuaternion(new Quaternion().copy(body.getRotation()).invert());
    const handle = world.createBody({ type: "kinematic", position: point });
    const joint = world.createDistanceJoint(handle, body, {
      anchorA: zero,
      anchorB: localPoint,
      length: 0.03,
      enableSpring: true,
      hertz: 5,
      dampingRatio: 0.9,
      lowerSpringForce: -totalMass * 300,
      upperSpringForce: totalMass * 300,
      collideConnected: false,
    });
    grab = {
      index,
      handle,
      joint,
      localPoint,
      target: new Vector3().copy(point),
    };
  }
  function moveGrab(point) {
    if (!grab || ![point.x, point.y, point.z].every(Number.isFinite)) return;
    // The floor follows free flight, so dragging must use world coordinates
    // without snapping back to the original display area or flight altitude.
    // The handle's speed limit below keeps fast pointer motion controlled.
    grab.target.copy(point);
    grab.target.y = Math.max(0.15, point.y);
  }
  function reset() {
    endGrab();
    mode = "rest";
    flightPath = null;
    flightState = null;
    manualFlight = null;
    attitudeHistory = [];
    configureFlight(false);
    impact = null;
    lastImpactTime = -Infinity;
    bodies.forEach((b, i) => {
      b.setTransform(vec(manifest.parts[i].center), identity);
      b.setLinearVelocity(zero);
      b.setAngularVelocity(zero);
    });
    joints.forEach((j) => j.setTargetRotation(identity));
  }
  function setMode(next) {
    endGrab();
    if (next === "flight" && mode !== "flight") {
      attitudeHistory = [];
      flightPath = createFlightPath(
        new Vector3().copy(bodies[0].getPosition()),
        new Quaternion().copy(bodies[0].getRotation()),
      );
    }
    if (mode !== next) manualFlight = null;
    mode = next;
    configureFlight(mode === "flight");
    if (mode !== "flight") flightState = null;
    bodies.forEach((b) => b.setAwake(true));
  }
  function takeControl() {
    if (mode !== "flight") return;
    manualIdle = 0;
    if (manualFlight) return;
    const head = bodies[0];
    manualFlight = createManualFlight(
      new Vector3().copy(head.getPosition()),
      new Quaternion().copy(head.getRotation()),
      new Vector3().copy(head.getLinearVelocity()),
    );
  }
  function resumeAutopilot() {
    if (mode !== "flight" || !manualFlight) return;
    const head = bodies[0];
    flightPath = createFlightPath(
      new Vector3().copy(head.getPosition()),
      new Quaternion().copy(head.getRotation()),
      new Vector3().copy(head.getLinearVelocity()),
    );
    manualFlight = null;
  }
  function step(dt, keys = new Set()) {
    // Refresh collisions and the pointer/flight controllers at 120 Hz so
    // fast neck/foot contacts cannot accumulate through a whole render step.
    const updates = mode === "grab" ? 4 : 2;
    for (let i = 0; i < updates; i++) integrate(dt / updates, keys);
  }

  function integrate(dt, keys) {
    simulationTime += dt;
    if (mode === "flight") {
      if (STEERING_KEYS.some((key) => keys.has(key))) takeControl();
      else if (manualFlight) {
        manualIdle += dt;
        if (manualIdle >= 5 - 1e-9) resumeAutopilot();
      }
      flightState = manualFlight
        ? manualFlight.step(
            dt,
            keys,
            new Vector3().copy(bodies[0].getPosition()),
          )
        : flightPath.step(dt);
      const body = bodies[0],
        p = body.getPosition(),
        velocity = body.getLinearVelocity();
      // The head is the only flight-path leader. Every other section is pulled
      // through its joints; none receives the head's current position or attitude.
      const acceleration = flightState.position
        .clone()
        .sub(new Vector3().copy(p))
        .multiplyScalar(14)
        .add(
          flightState.velocity
            .clone()
            .sub(new Vector3().copy(velocity))
            .multiplyScalar(7),
        );
      const supportedMass = bodies.reduce(
        (sum, b, i) => sum + b.getMass() * (i > 0 ? 0.18 : 1),
        0,
      );
      const force = acceleration.multiplyScalar(totalMass);
      force.y += supportedMass * 9.81;
      force.clampLength(0, totalMass * 85);
      body.applyForceToCenter(force, true);
      // Bank the shoulders, then the torso, after the head has already turned.
      const headingWithoutNeck = new Quaternion().copy(body.getRotation());
      if (flightState.neckRotation)
        headingWithoutNeck.multiply(flightState.neckRotation.clone().invert());
      attitudeHistory.push(headingWithoutNeck);
      if (attitudeHistory.length > 61) attitudeHistory.shift();
      for (let i = 0; i <= 2; i++) {
        const section = bodies[i],
          m = section.getMass(),
          av = section.getAngularVelocity();
        const attitude =
          i === 0
            ? flightState.rotation
            : attitudeHistory[
                Math.max(
                  0,
                  attitudeHistory.length -
                    1 -
                    Math.round((i === 1 ? 0.3 : 0.4) / dt),
                )
              ];
        dq.copy(attitude).multiply(
          new Quaternion().copy(section.getRotation()).invert(),
        );
        if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
        const torque = new Vector3(
          dq.x * 180 - av.x * 18,
          dq.y * 180 - av.y * 18,
          dq.z * 180 - av.z * 18,
        )
          .multiplyScalar(m)
          .clampLength(0, m * 180);
        section.applyTorque(torque, true);
      }
    }
    if (grab) {
      const velocity = grab.target
        .clone()
        .sub(new Vector3().copy(grab.handle.getPosition()))
        .divideScalar(dt)
        .clampLength(0, 30);
      grab.handle.setLinearVelocity(velocity);
    }
    const headPosition = bodies[0].getPosition(),
      floorPosition = ground.getPosition();
    const floorX = Math.round(headPosition.x / 48) * 48,
      floorZ = Math.round(headPosition.z / 48) * 48;
    if (floorPosition.x !== floorX || floorPosition.z !== floorZ)
      ground.setTransform({ x: floorX, y: -0.25, z: floorZ }, identity);
    world.step(dt, 6);
    for (const hit of world.getContactEvents().hit) {
      if (hit.shapeUserDataA !== 1 && hit.shapeUserDataB !== 1) continue;
      const index =
        (hit.shapeUserDataA === 1 ? hit.shapeUserDataB : hit.shapeUserDataA) -
        100;
      if (index < 0 || index >= bodies.length || hit.approachSpeed < 1.5)
        continue;
      if (simulationTime - lastImpactTime > 0.18) {
        impact = {
          sequence: ++impactSequence,
          point: hit.point,
          speed: hit.approachSpeed,
          part: index,
        };
        lastImpactTime = simulationTime;
      }
      // A solid head/body hit interrupts lift; gravity and restitution produce the bump.
      if (mode === "flight" && index <= 3) setMode("drop");
    }
  }
  return {
    bodies,
    joints,
    world,
    step,
    reset,
    setMode,
    takeControl,
    resumeAutopilot,
    get autopilotSecondsRemaining() {
      return mode === "flight" && manualFlight
        ? Math.max(0, 5 - manualIdle)
        : null;
    },
    get flightControl() {
      return mode === "flight" ? (manualFlight ? "manual" : "autopilot") : null;
    },
    beginGrab,
    moveGrab,
    endGrab,
    get grab() {
      if (!grab) return null;
      const body = bodies[grab.index];
      return {
        index: grab.index,
        target: grab.target.clone(),
        point: grab.localPoint
          .clone()
          .applyQuaternion(new Quaternion().copy(body.getRotation()))
          .add(new Vector3().copy(body.getPosition())),
      };
    },
    get impact() {
      return impact;
    },
    get flight() {
      return flightState;
    },
    get mode() {
      return mode;
    },
    dispose() {
      endGrab();
      world.destroy();
      joints.forEach((j) => j.delete());
      bodies.forEach((b) => b.delete());
      ground.delete();
      world.delete();
    },
  };
}
