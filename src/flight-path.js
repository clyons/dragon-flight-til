import { CatmullRomCurve3, Vector3, Quaternion, Matrix4 } from "three";

// A closed circuit with two low passes and climbing turns. Arc-length sampling
// keeps speed predictable even where the control points are unevenly spaced.
const circuit = new CatmullRomCurve3(
  [
    [0, 7, 0],
    [-8, 3.5, 2],
    [-11, 4, 9],
    [-6, 10, 16],
    [4, 12, 17],
    [11, 6, 11],
    [9, 3.5, 3],
    [4, 8, -1],
  ].map((p) => new Vector3(...p)),
  true,
  "centripetal",
);
circuit.arcLengthDivisions = 600;
const length = circuit.getLength();
const up = new Vector3(0, 1, 0),
  localX = new Vector3(1, 0, 0);
export function createFlightPath(
  start,
  rotation,
  entryVelocity = new Vector3(),
) {
  let distance = 0,
    elapsed = 0;
  const origin = new Vector3(start.x, Math.max(0, start.y - 7), start.z);
  // Start the circuit heading in the dragon's current horizontal direction.
  const forward = new Vector3(-1, 0, 0).applyQuaternion(rotation);
  const initial = circuit.getTangentAt(0);
  const yaw =
    Math.atan2(forward.z, -forward.x) - Math.atan2(initial.z, -initial.x);
  const orientation = new Quaternion().setFromAxisAngle(up, yaw);
  const previous = start.clone(),
    tangent = new Vector3(),
    q = new Quaternion();
  return {
    step(dt) {
      elapsed += dt;
      const phase = (distance % length) / length;
      // Gravity-assisted dives are faster; climbing turns slow down.
      const speed = 6.8 - circuit.getTangentAt(phase).y * 3;
      const launch = Math.min(1, elapsed / 3);
      const ease = launch * launch * (3 - 2 * launch);
      distance += speed * dt * ease;
      const u = (distance % length) / length;
      const turn = orientation;
      const position = circuit.getPointAt(u).applyQuaternion(turn).add(origin);
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
      tangent.copy(circuit.getTangentAt(u)).applyQuaternion(turn).normalize();
      const ahead = circuit.getTangentAt((u + 0.015) % 1).applyQuaternion(turn);
      const bank = Math.max(
        -0.65,
        Math.min(
          0.65,
          Math.atan2(
            tangent.x * ahead.z - tangent.z * ahead.x,
            tangent.x * ahead.x + tangent.z * ahead.z,
          ) * 4,
        ),
      );
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
