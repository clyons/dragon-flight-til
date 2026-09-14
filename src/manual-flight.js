import { Matrix4, Quaternion, Vector3 } from "three";

export const STEERING_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
];
const up = new Vector3(0, 1, 0),
  localX = new Vector3(1, 0, 0);
export function createManualFlight(position, rotation, velocity) {
  const forward = new Vector3(-1, 0, 0).applyQuaternion(rotation);
  let yaw = Math.atan2(forward.z, -forward.x);
  let pitch = Math.asin(Math.max(-1, Math.min(1, forward.y)));
  let speed = Math.max(4, Math.min(10, velocity.length())),
    bank = 0,
    lookYaw = 0,
    lookPitch = 0;
  const target = position.clone();
  return {
    step(dt, keys, headPosition) {
      const turn =
        Number(keys.has("ArrowLeft")) - Number(keys.has("ArrowRight"));
      const climb = Number(keys.has("ArrowUp")) - Number(keys.has("ArrowDown"));
      yaw += turn * dt * 0.9;
      lookYaw += (turn * 0.65 - lookYaw) * (1 - Math.exp(-dt * 6));
      // Lift the chin into a turn so the wide head clears the front feet.
      const turnClearance = Math.abs(turn) * 0.65 * (climb < 0 ? 0 : 1);
      lookPitch +=
        (-climb * 0.65 - turnClearance - lookPitch) * (1 - Math.exp(-dt * 6));
      pitch += (climb * 0.6 - pitch) * (1 - Math.exp(-dt * 3));
      bank += (turn * 0.5 - bank) * (1 - Math.exp(-dt * 4));
      speed += (6.8 - Math.sin(pitch) * 2 - speed) * (1 - Math.exp(-dt * 2));
      const tangent = new Vector3(
        -Math.cos(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.sin(yaw) * Math.cos(pitch),
      );
      const desiredVelocity = tangent.clone().multiplyScalar(speed);
      target.addScaledVector(desiredVelocity, dt);
      // Keep the virtual head target close enough to avoid stored-up spring force.
      target.sub(headPosition).clampLength(0, 1.5).add(headPosition);
      // Allow a dive to reach the physical floor. Collision response handles landing.
      target.y = Math.max(-0.5, target.y);
      const x = tangent.clone().negate(),
        z = new Vector3().crossVectors(x, up).normalize();
      const y = new Vector3().crossVectors(z, x).normalize();
      const attitude = new Quaternion()
        .setFromRotationMatrix(new Matrix4().makeBasis(x, y, z))
        .multiply(new Quaternion().setFromAxisAngle(localX, bank));
      const neckRotation = new Quaternion()
        .setFromAxisAngle(up, lookYaw)
        .multiply(
          new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), lookPitch),
        );
      attitude.multiply(neckRotation);
      return {
        neckRotation,
        position: target.clone(),
        velocity: desiredVelocity,
        rotation: attitude,
        tangent,
        bank,
        speed,
        phase:
          climb > 0
            ? "CLIMBING"
            : climb < 0
              ? "DIVING"
              : turn
                ? "TURNING"
                : "CRUISING",
      };
    },
  };
}
