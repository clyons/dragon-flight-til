import { Vector3, MathUtils } from 'three';
export function demoGrabOffset(t) {
  const shake = (s) => new Vector3(Math.sin(s*9)*1.3, 4+Math.sin(s*7)*.55, Math.cos(s*8)*.65);
  if (t < 7) {
    const amount = MathUtils.smoothstep(t,3,4);
    return new Vector3(amount*Math.sin(t*9)*1.3, MathUtils.smoothstep(t,0,3)*4+amount*Math.sin(t*7)*.55, amount*Math.cos(t*8)*.65);
  }
  const windup = new Vector3(-2.5,3,0);
  if (t < 8.4) return shake(7).lerp(windup,MathUtils.smoothstep(t,7,8.4));
  // Keep moving through release: the existing spring transfers this velocity.
  return windup.addScaledVector(new Vector3(18,14,-4),t-8.4);
}
