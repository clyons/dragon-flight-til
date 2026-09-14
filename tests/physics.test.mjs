import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Vector3, Quaternion, Box3 } from "three";
import { ConvexHull } from "three/addons/math/ConvexHull.js";
import { createSimulation } from "../src/physics.js";
import { createFlightPath } from "../src/flight-path.js";
const manifest = JSON.parse(
  readFileSync(new URL("../public/models/elder-fire/dragon.json", import.meta.url)),
);
test("hosted model is bounded, licensed and contains seven verified meshes", () => {
  assert.equal(manifest.model, "elder-fire");
  assert.equal(manifest.creator, "Biocraftlab");
  assert.equal(manifest.license, "CC-BY-NC-SA-4.0");
  assert.equal(manifest.parts.length, 7);
  assert.equal(manifest.anchors.length, 6);
  assert.ok(manifest.triangles < 150000);
  let triangles = 0, bytes = 0;
  for (const part of manifest.parts) {
    const data = readFileSync(new URL(`../public/models/elder-fire/${part.file}`, import.meta.url));
    assert.equal(createHash("sha256").update(data).digest("hex"), part.sha256);
    assert.equal(data.readUInt32LE(80), part.triangles);
    assert.equal(data.length, 84 + part.triangles * 50);
    triangles += part.triangles; bytes += data.length;
    assert.ok(part.hull.length <= 32);
  }
  assert.equal(triangles, manifest.triangles);
  assert.ok(bytes < 7500000, "prepared STL payload stays below 7.5 MB");
});
test("all outer wing geometry moves with the shoulders, never with the head", () => {
  let leftWingVertices = 0, rightWingVertices = 0;
  for (const [index, part] of manifest.parts.entries()) {
    const data = readFileSync(new URL(`../public/models/elder-fire/${part.file}`, import.meta.url));
    for (let face = 0; face < data.readUInt32LE(80); face++) {
      for (let vertex = 0; vertex < 3; vertex++) {
        const lateral = data.readFloatLE(84 + face * 50 + 12 + vertex * 12 + 8) + part.center[2];
        // All four feet and axial sections fit inside +/-2 scene units.
        // Anything outside is wing geometry and must share its rigid transform.
        if (Math.abs(lateral) <= 2) continue;
        assert.equal(index, 1, `wing vertex assigned to ${part.name}`);
        if (lateral < 0) leftWingVertices++; else rightWingVertices++;
      }
    }
  }
  assert.ok(leftWingVertices > 10000 && rightWingVertices > 10000, "both outer wings are present");
});
test("Box3D joints remain attached through rest, flight, steering, drop, reset", async () => {
  const sim = await createSimulation(manifest);
  const checkJoints = () =>
    manifest.anchors.forEach((a, i) => {
      const point = (index) =>
        new Vector3(...a)
          .sub(new Vector3(...manifest.parts[index].center))
          .applyQuaternion(
            new Quaternion().copy(sim.bodies[index].getRotation()),
          )
          .add(new Vector3().copy(sim.bodies[index].getPosition()));
      assert.ok(
        point(i).distanceTo(point(i + 1)) < 0.15,
        "joint anchors remain coincident",
      );
    });
  const finite = () =>
    sim.bodies.forEach((b) => {
      const p = b.getPosition();
      assert.ok([p.x, p.y, p.z].every(Number.isFinite));
      assert.ok(p.y > -0.6 && p.y < 25, `invalid height ${p.y}`);
    });
  try {
    for (let i = 0; i < 180; i++) sim.step(1 / 60);
    finite();
    checkJoints();
    sim.setMode("flight");
    for (let i = 0; i < 600; i++)
      sim.step(1 / 60, i > 300 ? new Set(["ArrowLeft", "ArrowUp"]) : new Set());
    finite();
    checkJoints();
    assert.ok(sim.bodies[2].getPosition().y > 3, "dragon takes flight");
    for (let i = 0; i < sim.bodies.length - 1; i++) {
      const a = sim.bodies[i].getPosition(),
        b = sim.bodies[i + 1].getPosition();
      assert.ok(
        Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 5,
        "sections stay connected",
      );
    }
    sim.setMode("drop");
    for (let i = 0; i < 600; i++) sim.step(1 / 60);
    finite();
    checkJoints();
    assert.ok(sim.bodies[2].getPosition().y < 3, "dragon lands");
    sim.reset();
    sim.bodies.forEach((b, i) => {
      const p = b.getPosition();
      ["x", "y", "z"].forEach((axis, j) =>
        assert.ok(Math.abs(p[axis] - manifest.parts[i].center[j]) < 1e-5),
      );
    });
  } finally {
    sim.dispose();
  }
});

test("grab lifts and shakes head, wings, and tail without breaking joints; release preserves momentum", async () => {
  const sim = await createSimulation(manifest);
  const verify = () => {
    for (const body of sim.bodies) {
      const p = body.getPosition();
      assert.ok([p.x, p.y, p.z].every(Number.isFinite));
      assert.ok(
        Math.abs(p.x) < 30 && p.y > -0.7 && p.y < 25 && Math.abs(p.z) < 30,
      );
    }
    manifest.anchors.forEach((anchor, i) => {
      const point = (index) =>
        new Vector3(...anchor)
          .sub(new Vector3(...manifest.parts[index].center))
          .applyQuaternion(
            new Quaternion().copy(sim.bodies[index].getRotation()),
          )
          .add(new Vector3().copy(sim.bodies[index].getPosition()));
      assert.ok(
        point(i).distanceTo(point(i + 1)) < 0.2,
        `body joints stay connected during shaking: joint ${i}, error ${point(i).distanceTo(point(i + 1))}`,
      );
    });
  };
  try {
    for (const index of [0, 2, 6]) {
      sim.reset();
      for (let frame = 0; frame < 120; frame++) sim.step(1 / 60);
      const start = new Vector3()
        .copy(sim.bodies[index].getPosition())
        .add(new Vector3(0.2, 0.5, 0.1));
      sim.beginGrab(index, start);
      assert.equal(sim.mode, "grab");
      for (let frame = 0; frame < 360; frame++) {
        const t = frame / 60;
        const target = start
          .clone()
          .add(
            new Vector3(
              Math.sin(t * 13) * 1.5,
              Math.min(t * 4, 7),
              Math.sin(t * 9) * 0.5,
            ),
          );
        sim.moveGrab(target);
        sim.step(1 / 60);
        verify();
      }
      assert.ok(
        sim.bodies[index].getPosition().y > 5,
        "selected section lifts the dragon",
      );
      assert.ok(
        sim.grab.point.distanceTo(sim.grab.target) < 2,
        "grab follows moving pointer",
      );
      const before = sim.bodies[index].getLinearVelocity();
      sim.endGrab();
      assert.equal(sim.grab, null);
      assert.equal(sim.mode, "drop");
      assert.deepEqual(
        sim.bodies[index].getLinearVelocity(),
        before,
        "release does not zero momentum",
      );
      for (let frame = 0; frame < 600; frame++) {
        sim.step(1 / 60);
        verify();
      }
      assert.ok(
        sim.bodies[index].getPosition().y < 3,
        "released dragon settles on ground",
      );
    }
    sim.beginGrab(2, sim.bodies[2].getPosition());
    sim.setMode("flight");
    assert.equal(sim.grab, null);
    sim.beginGrab(0, sim.bodies[0].getPosition());
    sim.reset();
    assert.equal(sim.grab, null);
    assert.equal(sim.mode, "rest");
    sim.endGrab();
    sim.endGrab();
  } finally {
    sim.dispose();
  }
});

test("higher route repeats circle, figure eight, reverse circle, figure eight without jumps", () => {
  const path = createFlightPath(new Vector3(0, 12, 0), new Quaternion());
  const transitions = [], turns = Array.from({ length: 8 }, () => ({ positive: 0, negative: 0 }));
  const crossings = new Map();
  let previous, low = Infinity, high = -Infinity;
  for (let frame = 0; frame < 150 * 60; frame++) {
    const state = path.step(1 / 60);
    const index = state.cycle * 4 + state.legIndex;
    if (!previous || index !== previous.cycle * 4 + previous.legIndex)
      transitions.push(state.legIndex);
    if (frame > 180) {
      low = Math.min(low, state.position.y);
      high = Math.max(high, state.position.y);
    }
    if (state.pattern === "figure-eight" && Math.abs(state.progress - 0.5) < 0.001)
      crossings.set(index, state.position.clone());
    if (previous) {
      assert.ok(state.position.distanceTo(previous.position) < 0.17, "target never teleports at pattern joins");
      assert.ok(state.rotation.angleTo(previous.rotation) < 0.05, "heading and bank change smoothly");
      const t = turns[previous.cycle * 4 + previous.legIndex];
      const a = previous.tangent, b = state.tangent;
      const angle = Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z);
      if (t) t[angle > 0 ? "positive" : "negative"] += angle;
    }
    previous = state;
  }
  assert.deepEqual(transitions, [0, 1, 2, 3, 0, 1, 2, 3, 0]);
  assert.ok(low > 7.5 && high > 17.5 && high < 18.1, "low passes and peaks are both raised");
  for (const offset of [0, 4]) {
    assert.ok(Math.abs(turns[offset].negative + 2 * Math.PI) < 0.05, "first circle turns once");
    assert.ok(Math.abs(turns[offset + 2].positive - 2 * Math.PI) < 0.05, "second circle turns once in the opposite direction");
    for (const i of [offset + 1, offset + 3]) {
      assert.ok(turns[i].positive > 4 && turns[i].negative < -4, "each figure eight banks both ways");
      assert.ok(Math.abs(turns[i].positive + turns[i].negative) < 0.05, "figure-eight lobes cancel their turn");
      const p = crossings.get(i);
      assert.ok(p && Math.hypot(p.x, p.z) < 0.2 && p.y > 17.5, "the two lobes meet above the starting crossing");
    }
  }
});

test("flight swoops through a circuit with its nose forward and a physically trailing tail", async () => {
  const sim = await createSimulation(manifest);
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  let samples = 0,
    facing = 0,
    trailing = 0,
    laggingFrames = 0,
    bankedFrames = 0,
    bodyToCurrentHead = 0,
    bodyToEarlierHead = 0;
  const headPositions = [];
  const phases = new Set();
  try {
    sim.setMode("flight");
    // Cover two complete four-pattern cycles with the actual articulated bodies.
    for (let frame = 0; frame < 9000; frame++) {
      sim.step(1 / 60);
      const torso = new Vector3().copy(sim.bodies[2].getPosition());
      headPositions.push(new Vector3().copy(sim.bodies[0].getPosition()));
      if (headPositions.length > 61) headPositions.shift();
      assert.ok(torso.toArray().every(Number.isFinite));
      if (frame < 240) continue;
      const head = new Vector3().copy(sim.bodies[0].getPosition());
      const tail = new Vector3().copy(sim.bodies[6].getPosition());
      const velocity = new Vector3()
        .copy(sim.bodies[2].getLinearVelocity())
        .normalize();
      const behind = torso.clone().sub(tail).dot(velocity);
      samples++;
      bodyToCurrentHead += torso.distanceTo(head);
      bodyToEarlierHead += torso.distanceTo(
        headPositions[Math.max(0, headPositions.length - 43)],
      );
      facing += head.clone().sub(torso).normalize().dot(velocity);
      trailing += behind;
      if (behind > 1) laggingFrames++;
      if (Math.abs(sim.flight.bank) > 0.2) bankedFrames++;
      phases.add(sim.flight.phase);
      for (const axis of ["X", "Y", "Z"]) {
        bounds[`min${axis}`] = Math.min(
          bounds[`min${axis}`],
          torso[axis.toLowerCase()],
        );
        bounds[`max${axis}`] = Math.max(
          bounds[`max${axis}`],
          torso[axis.toLowerCase()],
        );
      }
      assert.ok(
        head.distanceTo(sim.flight.position) < 2,
        "head follows the flight circuit",
      );
      manifest.anchors.forEach((anchor, i) => {
        const point = (index) =>
          new Vector3(...anchor)
            .sub(new Vector3(...manifest.parts[index].center))
            .applyQuaternion(
              new Quaternion().copy(sim.bodies[index].getRotation()),
            )
            .add(new Vector3().copy(sim.bodies[index].getPosition()));
        assert.ok(
          point(i).distanceTo(point(i + 1)) < 0.2,
          "swooping does not separate joints",
        );
      });
    }
    assert.ok(
      bounds.maxX - bounds.minX > 18 && bounds.maxZ - bounds.minZ > 15,
      "flies a broad circuit rather than hovering",
    );
    assert.ok(
      bounds.maxY - bounds.minY > 7,
      "alternates deep swoops and high climbs",
    );
    assert.ok(bounds.minY > 4.5, "the body has clearance throughout the higher route");
    assert.ok(facing / samples > 0.85, "head points in direction of travel");
    assert.ok(
      bodyToEarlierHead < bodyToCurrentHead * 0.7,
      "torso follows where the head was, rather than leading the swoop",
    );
    assert.ok(
      trailing / samples > 4 && laggingFrames / samples > 0.8,
      "tail predominantly trails behind the torso",
    );
    assert.ok(bankedFrames / samples > 0.4, "banks visibly into turns");
    assert.ok(phases.has("SWOOPING") && phases.has("CLIMBING"));
    // Recover the normal joint configuration when flight is interrupted.
    sim.beginGrab(6, sim.bodies[6].getPosition());
    assert.equal(sim.flight, null);
    assert.equal(sim.mode, "grab");
    sim.reset();
    sim.setMode("flight");
    for (let frame = 0; frame < 240; frame++) sim.step(1 / 60);
    assert.ok(sim.bodies[2].getPosition().y > 2, "flight restarts after reset");
  } finally {
    sim.dispose();
  }
});

test("steering takes over the head, coasts without autopilot, and resumes continuously", async () => {
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
    const sim = await createSimulation(manifest);
    try {
      // Leave wing clearance during sustained dives; impacts have a separate test.
      for (const body of sim.bodies) {
        const position = body.getPosition();
        body.setTransform(
          { ...position, y: position.y + 20 },
          body.getRotation(),
        );
      }
      sim.setMode("flight");
      for (let i = 0; i < 360; i++) sim.step(1 / 60);
      assert.equal(sim.flightControl, "autopilot");
      const before = new Vector3().copy(sim.bodies[0].getPosition());
      const originalForward = new Vector3(-1, 0, 0).applyQuaternion(
        new Quaternion().copy(sim.bodies[0].getRotation()),
      );
      sim.step(1 / 60, new Set([key]));
      assert.equal(sim.flightControl, "manual", `${key} interrupts autopilot`);
      assert.ok(
        before.distanceTo(new Vector3().copy(sim.bodies[0].getPosition())) <
          0.3,
        "takeover does not teleport the head",
      );
      for (let i = 0; i < 120; i++) sim.step(1 / 60, new Set([key]));
      const direction = sim.flight.tangent;
      if (key === "ArrowUp" || key === "ArrowDown") {
        assert.ok(
          sim.flight.velocity.y * (key === "ArrowUp" ? 1 : -1) > 2,
          `${key} steers vertically`,
        );
        const actualVelocity = sim.bodies[0].getLinearVelocity();
        assert.ok(
          actualVelocity.y * (key === "ArrowUp" ? 1 : -1) > 1,
          "physical head responds",
        );
      } else {
        const a = originalForward.clone().setY(0).normalize(),
          b = direction.clone().setY(0).normalize();
        const angle = Math.atan2(new Vector3().crossVectors(a, b).y, a.dot(b));
        assert.ok(
          angle * (key === "ArrowLeft" ? 1 : -1) > 1,
          `${key} turns the head in the requested direction`,
        );
      }
      const heading = direction.clone().setY(0).normalize();
      const coastStart = new Vector3().copy(sim.bodies[0].getPosition());
      for (let i = 0; i < 240; i++) sim.step(1 / 60);
      assert.equal(
        sim.flightControl,
        "manual",
        "manual control remains active during the five-second grace period",
      );
      assert.ok(
        heading.dot(sim.flight.tangent.clone().setY(0).normalize()) > 0.999,
        "coasts on the selected heading",
      );
      assert.ok(
        coastStart.distanceTo(new Vector3().copy(sim.bodies[0].getPosition())) >
          10,
        "keeps flying after release",
      );
      const pose = sim.bodies[0].getPosition(),
        velocity = sim.bodies[0].getLinearVelocity();
      sim.resumeAutopilot();
      assert.equal(sim.flightControl, "autopilot");
      assert.deepEqual(sim.bodies[0].getPosition(), pose);
      assert.deepEqual(sim.bodies[0].getLinearVelocity(), velocity);
      sim.step(1 / 60);
      assert.ok(
        new Vector3().copy(pose).distanceTo(sim.flight.position) < 0.3,
        "resumed route starts at the current head",
      );
      for (let i = 0; i < 360; i++) sim.step(1 / 60);
      assert.ok(
        new Vector3()
          .copy(sim.bodies[0].getPosition())
          .distanceTo(sim.flight.position) < 2,
        "autopilot recovers its path",
      );
      sim.takeControl();
      sim.beginGrab(0, sim.bodies[0].getPosition());
      assert.equal(sim.flightControl, null);
      sim.reset();
      sim.setMode("flight");
      assert.equal(sim.flightControl, "autopilot");
    } finally {
      sim.dispose();
    }
  }
});

test("free flight beyond the display circle still has ground when dropped", async () => {
  const sim = await createSimulation(manifest);
  try {
    sim.setMode("flight");
    for (let i = 0; i < 360; i++) sim.step(1 / 60);
    sim.takeControl();
    for (let i = 0; i < 1500; i++)
      sim.step(1 / 60, i % 240 === 0 ? new Set(["ArrowLeft"]) : new Set());
    const p = sim.bodies[0].getPosition();
    assert.ok(Math.hypot(p.x, p.z) > 100);
    sim.setMode("drop");
    for (let i = 0; i < 900; i++) sim.step(1 / 60);
    for (const body of sim.bodies) {
      const q = body.getPosition();
      assert.ok(
        Number.isFinite(q.y) && q.y > -0.5 && q.y < 3,
        "lands on the continuing floor",
      );
    }
  } finally {
    sim.dispose();
  }
});

test("autopilot resumes five seconds after steering ends, and new input restarts the timer", async () => {
  const sim = await createSimulation(manifest);
  try {
    sim.setMode("flight");
    for (let i = 0; i < 240; i++) sim.step(1 / 60);
    // A held key must never time out, even when held longer than five seconds.
    for (let i = 0; i < 420; i++) sim.step(1 / 60, new Set(["ArrowLeft"]));
    assert.equal(sim.flightControl, "manual");
    assert.equal(sim.autopilotSecondsRemaining, 5);
    for (let i = 0; i < 240; i++) sim.step(1 / 60);
    assert.equal(sim.flightControl, "manual");
    assert.ok(Math.abs(sim.autopilotSecondsRemaining - 1) < 1e-6);
    sim.step(1 / 60, new Set(["ArrowUp"]));
    assert.equal(sim.autopilotSecondsRemaining, 5);
    for (let i = 0; i < 299; i++) sim.step(1 / 60);
    assert.equal(sim.flightControl, "manual", "does not resume early");
    const before = sim.bodies[0].getPosition();
    sim.step(1 / 60);
    assert.equal(sim.flightControl, "autopilot");
    assert.equal(sim.autopilotSecondsRemaining, null);
    assert.ok(
      new Vector3()
        .copy(before)
        .distanceTo(new Vector3().copy(sim.bodies[0].getPosition())) < 0.3,
      "timeout handoff is continuous",
    );
    sim.step(1 / 60, new Set(["ArrowRight"]));
    assert.equal(
      sim.flightControl,
      "manual",
      "steering interrupts again immediately",
    );
    sim.resumeAutopilot();
    assert.equal(sim.flightControl, "autopilot", "explicit resume still works");
    sim.takeControl();
    sim.setMode("drop");
    for (let i = 0; i < 360; i++) sim.step(1 / 60);
    assert.equal(
      sim.mode,
      "drop",
      "an old countdown cannot restart flight after dropping",
    );
  } finally {
    sim.dispose();
  }
});

test("neck visibly leads steering with equal left/right travel and backward tilt on Up", async () => {
  const yaw = {};
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
    const sim = await createSimulation(manifest);
    try {
      // Start from the same straight pose, with clearance for a sustained dive.
      for (const body of sim.bodies) {
        const position = body.getPosition();
        body.setTransform(
          { ...position, y: position.y + 20 },
          body.getRotation(),
        );
      }
      sim.setMode("flight");
      let peak = 0;
      for (let frame = 0; frame < 180; frame++) {
        sim.step(1 / 60, new Set([key]));
        const relative = new Quaternion()
          .copy(sim.bodies[1].getRotation())
          .invert()
          .multiply(new Quaternion().copy(sim.bodies[0].getRotation()));
        const forward = new Vector3(-1, 0, 0).applyQuaternion(relative);
        const horizontal = Math.atan2(forward.z, -forward.x);
        const vertical = Math.asin(forward.y);
        const signed =
          key === "ArrowLeft"
            ? horizontal
            : key === "ArrowRight"
              ? -horizontal
              : key === "ArrowUp"
                ? vertical
                : -vertical;
        peak = Math.max(peak, signed);
        if (frame === 29)
          assert.ok(
            signed > 0.35,
            `${key}: clear neck indication within half a second`,
          );
        if (frame === 179) yaw[key] = horizontal;
        manifest.anchors.forEach((anchor, index) => {
          const point = (part) =>
            new Vector3(...anchor)
              .sub(new Vector3(...manifest.parts[part].center))
              .applyQuaternion(
                new Quaternion().copy(sim.bodies[part].getRotation()),
              )
              .add(new Vector3().copy(sim.bodies[part].getPosition()));
          assert.ok(
            point(index).distanceTo(point(index + 1)) < 0.2,
            "flexible neck and body stay attached",
          );
        });
      }
      const turning = key === "ArrowLeft" || key === "ArrowRight";
      assert.ok(
        peak > (turning ? 0.6 : 0.7),
        `${key}: neck remains flexible while solid feet limit lateral travel`,
      );
    } finally {
      sim.dispose();
    }
  }
  assert.ok(
    Math.abs(yaw.ArrowLeft + yaw.ArrowRight) < 0.14,
    "left and right sustained neck travel match within eight degrees",
  );
});

test("diving reaches the floor, rebounds, and settles under gravity", async () => {
  const sim = await createSimulation(manifest);
  try {
    sim.setMode("flight");
    for (let frame = 0; frame < 360; frame++) sim.step(1 / 60);
    let hit = null,
      rebound = 0;
    for (let frame = 0; frame < 600; frame++) {
      sim.step(1 / 60, new Set(["ArrowDown"]));
      if (sim.mode === "drop" && !hit) hit = sim.impact;
      // A banked landing can keep the head in contact while the torso rebounds.
      if (hit) rebound = Math.max(rebound, ...sim.bodies.slice(0, 4).map(body => body.getLinearVelocity().y));
    }
    assert.ok(
      hit && hit.part <= 3 && hit.speed > 1.5,
      "physical head/body impact releases lift",
    );
    assert.ok(Math.abs(hit.point.y) < 0.1, "impact is on the actual floor");
    assert.ok(rebound > 0.5, "collision produces a visible upward rebound");
    assert.equal(
      sim.flightControl,
      null,
      "gravity remains active after the bump",
    );
    for (const body of sim.bodies) {
      assert.ok(
        body.getPosition().y > -0.5 && body.getPosition().y < 3,
        "lands above the floor",
      );
      assert.ok(
        new Vector3().copy(body.getLinearVelocity()).length() < 0.5,
        "bounce settles",
      );
    }
    sim.reset();
    assert.equal(sim.impact, null, "reset clears the impact indicator");
    sim.setMode("flight");
    for (let frame = 0; frame < 240; frame++) sim.step(1 / 60);
    assert.equal(
      sim.flightControl,
      "autopilot",
      "can take off again after impact",
    );
  } finally {
    sim.dispose();
  }
});

test("head geometry stays outside all four feet during steering and fast shaking", async () => {
  const stl = readFileSync(
      new URL("../public/models/elder-fire/head.stl", import.meta.url),
    ),
    unique = new Map();
  for (let i = 0; i < stl.readUInt32LE(80); i++)
    for (let j = 0; j < 3; j++) {
      const p = new Vector3(
        ...[0, 1, 2].map((c) =>
          stl.readFloatLE(84 + i * 50 + 12 + j * 12 + c * 4),
        ),
      );
      unique.set(p.toArray().join(","), p);
    }
  const vertices = [...unique.values()];
  const feet = manifest.parts.flatMap((part, index) =>
    (part.footHulls ?? []).map((points) => ({
      index,
      hull: new ConvexHull().setFromPoints(
        points.map((p) => new Vector3(...p)),
      ),
      box: new Box3().setFromPoints(points.map((p) => new Vector3(...p))),
    })),
  );
  function penetration(sim) {
    let deepest = 0;
    const headPosition = new Vector3().copy(sim.bodies[0].getPosition()),
      headRotation = new Quaternion().copy(sim.bodies[0].getRotation());
    for (const foot of feet) {
      const inverse = new Quaternion()
        .copy(sim.bodies[foot.index].getRotation())
        .invert();
      const q = inverse.clone().multiply(headRotation),
        t = headPosition
          .clone()
          .sub(new Vector3().copy(sim.bodies[foot.index].getPosition()))
          .applyQuaternion(inverse);
      const p = new Vector3();
      for (const vertex of vertices) {
        p.copy(vertex).applyQuaternion(q).add(t);
        if (!foot.box.containsPoint(p)) continue;
        let distance = -Infinity;
        for (const face of foot.hull.faces) {
          distance = Math.max(distance, face.distanceToPoint(p));
          if (distance >= 0) break;
        }
        deepest = Math.max(deepest, -distance);
      }
    }
    return deepest;
  }

  assert.ok(
    manifest.parts[0].headContactHulls.length > 1,
    "compound head leaves room beneath the horns",
  );
  for (const part of [1, 3])
    assert.ok(
      manifest.parts[part].footHulls.length >= 2,
      "both feet have collision geometry",
    );
  const headHulls = manifest.parts[0].headContactHulls.map((points) =>
    new ConvexHull().setFromPoints(points.map((p) => new Vector3(...p))),
  );
  for (const vertex of vertices)
    assert.ok(
      headHulls.some((hull) => hull.containsPoint(vertex)),
      "collision hulls enclose the rendered head, including horns",
    );
  const clear = (sim) =>
    assert.ok(
      penetration(sim) < 0.03,
      "head cannot pass into a foot beyond solver contact tolerance",
    );
  for (const input of [
    ["ArrowLeft"],
    ["ArrowRight"],
    ["ArrowUp"],
    ["ArrowDown"],
    ["ArrowLeft", "ArrowDown"],
    ["ArrowRight", "ArrowDown"],
  ]) {
    const sim = await createSimulation(manifest);
    try {
      for (const body of sim.bodies) {
        const position = body.getPosition();
        body.setTransform(
          { ...position, y: position.y + 20 },
          body.getRotation(),
        );
      }
      sim.setMode("flight");
      for (let frame = 0; frame < 240; frame++) {
        sim.step(1 / 60, new Set(input));
        clear(sim);
      }
    } finally {
      sim.dispose();
    }
  }
  const sim = await createSimulation(manifest);
  try {
    for (const index of [0, 1, 2, 6]) {
      sim.reset();
      for (let frame = 0; frame < 120; frame++) sim.step(1 / 60);
      const start = new Vector3().copy(sim.bodies[index].getPosition());
      sim.beginGrab(index, start);
      for (let frame = 0; frame < 360; frame++) {
        const t = frame / 60;
        sim.moveGrab(
          start
            .clone()
            .add(
              new Vector3(
                Math.sin(t * 13) * 1.5,
                Math.min(t * 4, 7),
                Math.sin(t * 9) * 0.5,
              ),
            ),
        );
        sim.step(1 / 60);
        clear(sim);
      }
      sim.endGrab();
    }
  } finally {
    sim.dispose();
  }
});

test("grabbing after distant or high flight stays at the cursor instead of snapping toward the origin", async () => {
  for (const [index, offset] of [
    [0, new Vector3(80, 0, -65)],
    [2, new Vector3(-90, 0, 75)],
    [6, new Vector3(80, 25, -65)],
  ]) {
    const sim = await createSimulation(manifest);
    try {
      for (const body of sim.bodies)
        body.setTransform(
          new Vector3().copy(body.getPosition()).add(offset),
          body.getRotation(),
        );
      const start = new Vector3()
        .copy(sim.bodies[index].getPosition())
        .add(new Vector3(0, 0.5, 0));
      sim.beginGrab(index, start);
      const before = new Vector3().copy(sim.bodies[index].getPosition());
      const nudge = start.clone().add(new Vector3(0.1, 0.1, 0));
      sim.moveGrab(nudge);
      assert.ok(
        sim.grab.target.distanceTo(nudge) < 1e-8,
        "small pointer motion stays in the dragon's current world location",
      );
      sim.step(1 / 60);
      assert.ok(
        new Vector3().copy(sim.bodies[index].getPosition()).distanceTo(before) <
          0.1,
        "beginning a drag does not yank the selected part away",
      );
      for (let frame = 0; frame < 360; frame++) {
        const t = frame / 60;
        const target = start
          .clone()
          .add(new Vector3(Math.min(t, 2), Math.min(t * 4, 7), 0));
        sim.moveGrab(target);
        assert.ok(
          sim.grab.target.distanceTo(target) < 1e-8,
          "cursor tracking has no old world-position or altitude cap",
        );
        sim.step(1 / 60);
      }
      assert.ok(
        sim.grab.point.distanceTo(sim.grab.target) < 2,
        "the held part follows a distant or elevated pointer",
      );
      assert.ok(
        sim.bodies[index].getPosition().y > before.y + 5,
        "can still lift after flying away",
      );
      const velocity = sim.bodies[index].getLinearVelocity();
      sim.endGrab();
      assert.deepEqual(
        sim.bodies[index].getLinearVelocity(),
        velocity,
        "release keeps momentum",
      );
    } finally {
      sim.dispose();
    }
  }
});
