import { CatmullRomCurve3, Vector3, Quaternion, Matrix4 } from "three";

// All four patterns meet at the same point and heading. Keeping the wings
// above the old low passes also gives this broader dragon room to bank.
const entryHeight = 12;
const sequence = [
  { kind: "circle", direction: 1 },
  { kind: "figure-eight", direction: 1 },
  { kind: "circle", direction: -1 },
  { kind: "figure-eight", direction: -1 },
].map(({ kind, direction }) => {
  const points = Array.from({ length: 64 }, (_, index) => {
    const angle = index / 64 * Math.PI * 2;
    const height = entryHeight + 6 * Math.sin(angle / 2) ** 2 - 7 * Math.sin(angle) ** 2;
    if (kind === "circle")
      return new Vector3(-14 * Math.sin(angle), height, direction * 14 * (1 - Math.cos(angle)));
    // A Gerono figure eight, rotated so its crossing tangent is forward.
    const point = new Vector3(-22 * Math.sin(angle), 0, direction * 10 * Math.sin(2 * angle));
    point.applyAxisAngle(new Vector3(0, 1, 0), -Math.atan2(direction * 20, 22));
    point.y = height;
    return point;
  });
  const curve = new CatmullRomCurve3(points, true, "centripetal");
  curve.arcLengthDivisions = 600;
  return { kind, direction, curve, length: curve.getLength() };
});
const up = new Vector3(0, 1, 0),
  localX = new Vector3(1, 0, 0);
export function createFlightPath(
  start,
  rotation,
  entryVelocity = new Vector3(),
) {
  let distance = 0,
    elapsed = 0,
    legIndex = 0,
    cycle = 0,
    bank = 0;
  const origin = new Vector3(start.x, Math.max(0, start.y - entryHeight), start.z);
  // Start the circuit heading in the dragon's current horizontal direction.
  const forward = new Vector3(-1, 0, 0).applyQuaternion(rotation);
  const initial = sequence[0].curve.getTangentAt(0);
  const yaw =
    Math.atan2(forward.z, -forward.x) - Math.atan2(initial.z, -initial.x);
  const orientation = new Quaternion().setFromAxisAngle(up, yaw);
  const previous = start.clone(),
    tangent = new Vector3(),
    q = new Quaternion();
  return {
    step(dt) {
      elapsed += dt;
      let leg = sequence[legIndex];
      const phase = distance / leg.length;
      // Gravity-assisted dives are faster; climbing turns slow down.
      const speed = 6.8 - leg.curve.getTangentAt(phase).y * 3;
      const launch = Math.min(1, elapsed / 3);
      const ease = launch * launch * (3 - 2 * launch);
      distance += speed * dt * ease;
      while (distance >= leg.length) {
        distance -= leg.length;
        legIndex = (legIndex + 1) % sequence.length;
        if (legIndex === 0) cycle++;
        leg = sequence[legIndex];
      }
      const u = distance / leg.length;
      const turn = orientation;
      const position = leg.curve.getPointAt(u).applyQuaternion(turn).add(origin);
      position.lerp(
        start.clone().addScaledVector(entryVelocity, elapsed),
        1 - ease,
      );
      const velocity = position
        .clone()
        .sub(previous)
        .divideScalar(dt)
        .clampLength(0, 12);
      previous.copy(position);
      tangent.copy(leg.curve.getTangentAt(u)).applyQuaternion(turn).normalize();
      const aheadDistance = distance + 1.5;
      const nextLeg = sequence[(legIndex + 1) % sequence.length];
      const ahead = (aheadDistance < leg.length
        ? leg.curve.getTangentAt(aheadDistance / leg.length)
        : nextLeg.curve.getTangentAt((aheadDistance - leg.length) / nextLeg.length)
      ).applyQuaternion(turn);
      const targetBank = Math.max(
        -0.65,
        Math.min(
          0.65,
          Math.atan2(
            tangent.x * ahead.z - tangent.z * ahead.x,
            tangent.x * ahead.x + tangent.z * ahead.z,
          ) * 4,
        ),
      );
      bank += (targetBank - bank) * (1 - Math.exp(-4 * dt));
      const x = tangent.clone().negate(),
        z = new Vector3().crossVectors(x, up).normalize();
      const y = new Vector3().crossVectors(z, x).normalize();
      q.setFromRotationMatrix(new Matrix4().makeBasis(x, y, z)).multiply(
        new Quaternion().setFromAxisAngle(localX, bank),
      );
      q.slerp(rotation, 1 - ease);
      return {
        position,
        velocity,
        rotation: q.clone(),
        tangent: tangent.clone(),
        bank,
        speed,
        legIndex,
        cycle,
        pattern: leg.kind,
        progress: u,
        phase:
          launch < 1
            ? entryVelocity.lengthSq() > 0.01
              ? "JOINING ROUTE"
              : "TAKING OFF"
            : tangent.y < -0.2
              ? "SWOOPING"
              : tangent.y > 0.2
                ? "CLIMBING"
                : "BANKING",
      };
    },
  };
}
