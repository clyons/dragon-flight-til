import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createSimulation } from "./physics.js";
import { STEERING_KEYS } from "./manual-flight.js";

const $ = (id) => document.getElementById(id);
async function start() {
  const renderer = new THREE.WebGLRenderer({
    canvas: $("scene"),
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eae7df");
  scene.fog = new THREE.Fog("#eae7df", 35, 75);
  const camera = new THREE.PerspectiveCamera(
    36,
    innerWidth / innerHeight,
    0.1,
    160,
  );
  const homeTarget = new THREE.Vector3(innerWidth < 700 ? 0 : -2.3, 0.5, 0);
  let fitScale = Math.max(1, 1.1 / camera.aspect);
  camera.position.set(6, 12, 20).multiplyScalar(fitScale).add(homeTarget);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(homeTarget);
  controls.enableDamping = true;
  controls.minDistance = 8;
  controls.maxDistance = 48 * fitScale;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.enablePan = false;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.05);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.65;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfaf5e8, 0x748376, 0.85));
  const sun = new THREE.DirectionalLight(0xfff5de, 2.6);
  sun.position.set(-7, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -20,
    right: 20,
    top: 20,
    bottom: -20,
    near: 0.5,
    far: 55,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0001;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xc6deed, 0.8);
  fill.position.set(8, 9, -8);
  scene.add(fill);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: 0xeae7df, roughness: 0.96 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.015;
  ground.receiveShadow = true;
  scene.add(ground);
  const rings = new THREE.Group();
  for (const r of [8, 12, 18, 24]) {
    const points = [];
    for (let j = 0; j <= 160; j++)
      points.push(
        new THREE.Vector3(
          Math.cos((j / 160) * Math.PI * 2) * r,
          0.002,
          Math.sin((j / 160) * Math.PI * 2) * r,
        ),
      );
    rings.add(
      new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: 0xc6c9bc,
          transparent: true,
          opacity: 0.27,
        }),
      ),
    );
  }
  scene.add(rings);
  const response = await fetch(`${import.meta.env.BASE_URL}models/elder-fire/dragon.json`);
  if (!response.ok) throw new Error("The dragon could not load. Refresh the page to try again.");
  const manifest = await response.json();
  const finishDefaults = {
    metalness: 0,
    roughness: 0.5,
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    transmission: 0,
    thickness: 0,
    ior: 1.5,
    attenuationColor: 0xffffff,
    attenuationDistance: Infinity,
    specularIntensity: 1,
    envMapIntensity: 1,
  };
  const finishes = {
    jade: {
      color: 0x429b76,
      roughness: 0.14,
      transmission: 0.45,
      thickness: 0.7,
      attenuationColor: 0x25865c,
      attenuationDistance: 2,
      clearcoat: 0.75,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.15,
    },
    copper: {
      color: 0xb86d42,
      metalness: 0.85,
      roughness: 0.3,
      envMapIntensity: 1.1,
    },
    obsidian: {
      color: 0x24282b,
      roughness: 0.68,
      specularIntensity: 0.6,
      envMapIntensity: 0.95,
    },
  };
  const material = new THREE.MeshPhysicalMaterial({
    ...finishDefaults,
    ...(finishes[$("finish").value] ?? finishes.jade),
  });
  const loader = new STLLoader();
  const meshes = await Promise.all(
    manifest.parts.map(async (p) => {
      const raw = await loader.loadAsync(`${import.meta.env.BASE_URL}models/elder-fire/${p.file}`);
      raw.deleteAttribute("normal");
      const geometry = mergeVertices(raw, 1e-5);
      geometry.computeVertexNormals();
      raw.dispose();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.fromArray(p.center);
      scene.add(mesh);
      return mesh;
    }),
  );
  // A soft contact shadow tightens and darkens as each section nears the floor.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext("2d");
  const gradient = shadowContext.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,0.85)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  shadowContext.fillStyle = gradient;
  shadowContext.fillRect(0, 0, 128, 128);
  const contactTexture = new THREE.CanvasTexture(shadowCanvas);
  const contactGeometry = new THREE.PlaneGeometry(1, 1);
  const contactBounds = new THREE.Box3(),
    contactSize = new THREE.Vector3();
  const contactShadows = meshes.map(() => {
    const shadow = new THREE.Mesh(
      contactGeometry,
      new THREE.MeshBasicMaterial({
        map: contactTexture,
        color: 0x24372f,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.008;
    scene.add(shadow);
    return shadow;
  });
  const sim = await createSimulation(manifest);
  const flightBounds = new THREE.Box3();
  let paused = false,
    resetTransition = null,
    accumulator = 0,
    last = performance.now(),
    uiTime = 0;
  const keys = new Set();
  let displayedFlightControl = null,
    seenImpact = 0,
    impactAge = Infinity;
  const fly = $("fly"),
    pause = $("pause");
  for (const id of ["fly", "reset", "pause", "grab"]) $(id).disabled = false;
  let grabMode = false,
    grabPointer = null,
    selectedMesh = null;
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(),
    dragPoint = new THREE.Vector3();
  const grabMaterial = material.clone();
  function updateGrabMaterial() {
    grabMaterial.copy(material);
    // Lift the finish's own hue; a little white keeps dark obsidian readable.
    grabMaterial.emissive
      .copy(material.color)
      .lerp(new THREE.Color(0xffffff), 0.08);
    grabMaterial.emissiveIntensity = 0.25;
  }
  updateGrabMaterial();
  const tetherGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const tetherMaterial = new THREE.LineBasicMaterial({
    color: 0x285d43,
    depthTest: false,
    transparent: true,
    opacity: 0.7,
  });
  const tether = new THREE.Line(tetherGeometry, tetherMaterial);
  tether.visible = false;
  tether.frustumCulled = false;
  tether.renderOrder = 10;
  scene.add(tether);
  const grabMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0x285d43, depthTest: false }),
  );
  grabMarker.visible = false;
  grabMarker.renderOrder = 11;
  scene.add(grabMarker);
  function releaseGrab() {
    const id = grabPointer;
    grabPointer = null;
    sim.endGrab();
    if (selectedMesh) selectedMesh.material = material;
    selectedMesh = null;
    tether.visible = false;
    grabMarker.visible = false;
    controls.enabled = !resetTransition;
    if (id !== null && renderer.domElement.hasPointerCapture(id))
      renderer.domElement.releasePointerCapture(id);
    updateButtons();
  }
  function setGrabMode(enabled) {
    if (resetTransition) return;
    releaseGrab();
    grabMode = enabled;
    if (enabled) {
      sim.setMode("drop");
      paused = false;
    }
    controls.enableRotate = !enabled;
    updateButtons();
  }
  function aim(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
  }
  renderer.domElement.addEventListener(
    "pointerdown",
    (event) => {
      if (
        !grabMode ||
        resetTransition ||
        !event.isPrimary ||
        event.button !== 0 ||
        grabPointer !== null
      )
        return;
      aim(event);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      if (!hit) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // Freeze the camera so a screen-space drag stays on the initial grab plane.
      controls.enabled = false;
      camera.getWorldDirection(dragPoint);
      dragPlane.setFromNormalAndCoplanarPoint(dragPoint, hit.point);
      sim.beginGrab(meshes.indexOf(hit.object), hit.point);
      grabPointer = event.pointerId;
      paused = false;
      selectedMesh = hit.object;
      updateGrabMaterial();
      selectedMesh.material = grabMaterial;
      renderer.domElement.setPointerCapture(event.pointerId);
      updateButtons();
    },
    { capture: true },
  );
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!grabMode) return;
    aim(event);
    if (grabPointer !== null) {
      if (event.pointerId !== grabPointer) return;
      if (raycaster.ray.intersectPlane(dragPlane, dragPoint))
        sim.moveGrab(dragPoint);
    } else
      renderer.domElement.style.cursor = raycaster.intersectObjects(
        meshes,
        false,
      ).length
        ? "grab"
        : "crosshair";
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    renderer.domElement.addEventListener(type, (event) => {
      if (event.pointerId === grabPointer) releaseGrab();
    });
  }
  $("grab").addEventListener("click", () => setGrabMode(!grabMode));
  function updateAutopilotCountdown() {
    const remaining = sim.autopilotSecondsRemaining;
    $("autopilot").textContent =
      remaining === null
        ? "Autopilot on"
        : `Autopilot in ${Math.ceil(remaining)}s`;
    $("autopilot").setAttribute(
      "aria-label",
      remaining === null ? "Autopilot on" : "Resume autopilot now",
    );
    $("autopilot").title =
      remaining === null
        ? "Use an arrow to take control"
        : "Click to resume now, or release steering for five seconds";
  }
  function flightStatus() {
    return `${sim.flightControl === "manual" ? "MANUAL" : "AUTO"} · ${sim.flight?.phase ?? "TAKING OFF"}`;
  }
  function dropStatus() {
    if (impactAge < 1.2) return "BUMP!";
    // Use the solver's settled state, so the top of a toss is still FALLING.
    return sim.bodies.every((body) => !body.isAwake()) ? "AT REST" : "FALLING";
  }
  function updateButtons() {
    const flight = sim.mode === "flight";
    displayedFlightControl = sim.flightControl;
    const manual = sim.flightControl === "manual";
    $("autopilot").disabled = !manual || !!resetTransition;
    for (const id of ["fly", "reset", "pause", "grab"])
      $(id).disabled = !!resetTransition;
    updateAutopilotCountdown();
    $("grab").setAttribute("aria-pressed", String(grabMode));
    renderer.domElement.style.cursor =
      grabPointer !== null ? "grabbing" : grabMode ? "grab" : "auto";
    $("interaction-hint").textContent = grabMode
      ? "Drag any part · G to exit"
      : flight
        ? "Arrow keys to steer · Drag to look around"
        : "Drag to look around · Scroll to zoom · / for help";
    fly.innerHTML = flight
      ? "<span>↘</span> Drop"
      : "<span>↗</span> Take flight";
    $("flight-controls").hidden = !flight;
    pause.textContent = paused ? "▶" : "Ⅱ";
    pause.setAttribute(
      "aria-label",
      paused ? "Resume simulation" : "Pause simulation",
    );
    $("mode-label").textContent = paused
      ? "PAUSED"
      : grabPointer !== null
        ? "HOLDING " + manifest.parts[sim.grab.index].name.toUpperCase()
        : grabMode
          ? "GRAB A PART"
          : flight
            ? flightStatus()
            : sim.mode === "drop"
              ? dropStatus()
              : "AT REST";
  }
  function steer(key) {
    if (resetTransition) return;
    keys.add(key);
    if (sim.mode === "flight" && STEERING_KEYS.includes(key)) {
      sim.takeControl();
      updateButtons();
    }
  }
  $("autopilot").addEventListener("click", () => {
    if (resetTransition) return;
    STEERING_KEYS.forEach((key) => keys.delete(key));
    sim.resumeAutopilot();
    updateButtons();
  });
  function togglePause() {
    if (resetTransition) return;
    releaseGrab();
    paused = !paused;
    accumulator = 0;
    updateButtons();
  }
  fly.addEventListener("click", () => {
    if (resetTransition) return;
    setGrabMode(false);
    const takingOff = sim.mode !== "flight";
    sim.setMode(takingOff ? "flight" : "drop");
    if (takingOff) {
      const view = camera.position.clone().sub(controls.target);
      view.setLength(Math.max(view.length(), 30 * fitScale));
      camera.position.copy(controls.target).add(view);
    }
    paused = false;
    updateButtons();
  });
  function reset() {
    if (resetTransition) return;
    releaseGrab();
    keys.clear();
    accumulator = 0;
    const reducedMotion = matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    resetTransition = {
      elapsed: 0,
      swapped: false,
      fadeOut: reducedMotion ? 0.05 : 0.18,
      hold: reducedMotion ? 0.02 : 0.04,
      fadeIn: reducedMotion ? 0.05 : 0.28,
    };
    controls.enabled = false;
    updateButtons();
  }
  function advanceReset(dt) {
    if (!resetTransition || document.hidden) return;
    const transition = resetTransition;
    transition.elapsed += dt;
    const revealAt = transition.fadeOut + transition.hold;
    if (!transition.swapped && transition.elapsed >= transition.fadeOut) {
      sim.reset();
      paused = false;
      accumulator = 0;
      impactAge = Infinity;
      // Clear any lingering orbit momentum before restoring the home camera.
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      camera.position.set(6, 12, 20).multiplyScalar(fitScale).add(homeTarget);
      controls.target.copy(homeTarget);
      controls.update();
      controls.enableDamping = damping;
      transition.swapped = true;
      updateButtons();
    }
    const opacity =
      transition.elapsed < transition.fadeOut
        ? 1 -
          THREE.MathUtils.smoothstep(transition.elapsed, 0, transition.fadeOut)
        : THREE.MathUtils.smoothstep(
            transition.elapsed - revealAt,
            0,
            transition.fadeIn,
          );
    renderer.domElement.style.opacity = String(opacity);
    if (transition.elapsed >= revealAt + transition.fadeIn) {
      resetTransition = null;
      renderer.domElement.style.removeProperty("opacity");
      controls.enabled = true;
      updateButtons();
    }
  }
  $("reset").addEventListener("click", reset);
  pause.addEventListener("click", togglePause);
  function toggleHelp() {
    $("help-panel").hidden = !$("help-panel").hidden;
    $("help").setAttribute("aria-expanded", String(!$("help-panel").hidden));
  }
  $("help").addEventListener("click", toggleHelp);
  $("finish").addEventListener("change", (event) => {
    // Reset every optical property so glass cannot leak into the opaque finishes.
    material.setValues({ ...finishDefaults, ...finishes[event.target.value] });
    updateGrabMaterial();
    event.currentTarget.blur();
  });
  addEventListener("keydown", (event) => {
    if (
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLInputElement
    )
      return;
    if (
      (event.key === "/" || event.key === "?") &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      if (!event.repeat) toggleHelp();
      return;
    }
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
        event.code,
      )
    )
      event.preventDefault();
    steer(event.code);
    if (!event.repeat && event.code === "Space") togglePause();
    if (!event.repeat && event.code === "KeyR") reset();
    if (!event.repeat && event.code === "KeyG") setGrabMode(!grabMode);
  });
  addEventListener("keyup", (event) => keys.delete(event.code));
  addEventListener("blur", () => {
    keys.clear();
    releaseGrab();
  });
  document.querySelectorAll("[data-key]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      button.setPointerCapture(event.pointerId);
      steer(button.dataset.key);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      button.addEventListener(type, () => keys.delete(button.dataset.key));
  });
  addEventListener("resize", () => {
    releaseGrab();
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    const nextFit = Math.max(1, 1.1 / camera.aspect);
    camera.position
      .sub(controls.target)
      .multiplyScalar(nextFit / fitScale)
      .add(controls.target);
    fitScale = nextFit;
    controls.maxDistance = 48 * fitScale;
    homeTarget.x = innerWidth < 700 ? 0 : -2.3;
    if (sim.mode === "rest") {
      camera.position.add(homeTarget.clone().sub(controls.target));
      controls.target.copy(homeTarget);
    }
    renderer.setSize(innerWidth, innerHeight);
  });
  document.addEventListener("visibilitychange", () => {
    releaseGrab();
    last = performance.now();
    accumulator = 0;
    keys.clear();
  });
  updateButtons();
  function animate(now) {
    const dt = Math.min((now - last) / 1000, 0.08);
    last = now;
    advanceReset(dt);
    if (!document.hidden && !paused && !resetTransition) {
      accumulator += dt;
      while (accumulator >= 1 / 60) {
        sim.step(1 / 60, keys);
        accumulator -= 1 / 60;
      }
    }
    meshes.forEach((mesh, i) => {
      mesh.position.copy(sim.bodies[i].getPosition());
      mesh.quaternion.copy(sim.bodies[i].getRotation());
    });
    // The seamless floor follows free flight beyond the original display circle.
    ground.position.x = meshes[2].position.x;
    ground.position.z = meshes[2].position.z;
    // Keep the real cast shadow in the light's frustum throughout free flight.
    sun.position.set(
      ground.position.x - 7,
      Math.max(18, meshes[2].position.y + 12),
      ground.position.z + 10,
    );
    sun.target.position.set(
      ground.position.x,
      meshes[2].position.y * 0.5,
      ground.position.z,
    );
    meshes.forEach((mesh, i) => {
      mesh.updateMatrixWorld();
      contactBounds.setFromObject(mesh);
      contactBounds.getSize(contactSize);
      const height = Math.max(0, contactBounds.min.y);
      const shadow = contactShadows[i];
      contactBounds.getCenter(shadow.position);
      shadow.position.y = -0.008;
      shadow.scale.set(
        contactSize.x * 1.15 + height * 0.35,
        contactSize.z * 1.15 + height * 0.35,
        1,
      );
      shadow.material.opacity = 0.48 * Math.exp(-height * 0.75);
      shadow.visible = height < 9;
    });
    if (sim.impact && sim.impact.sequence !== seenImpact) {
      seenImpact = sim.impact.sequence;
      impactAge = 0;
    } else if (!paused) impactAge += dt;
    if (!sim.impact) impactAge = Infinity;
    if (displayedFlightControl !== sim.flightControl) updateButtons();
    const held = sim.grab;
    if (held) {
      const positions = tetherGeometry.attributes.position;
      positions.setXYZ(0, held.point.x, held.point.y, held.point.z);
      positions.setXYZ(1, held.target.x, held.target.y, held.target.z);
      positions.needsUpdate = true;
      tether.visible = true;
      grabMarker.visible = true;
      grabMarker.position.copy(held.target);
    }
    if (
      !grabMode &&
      !resetTransition &&
      (sim.mode === "flight" || sim.mode === "drop")
    ) {
      const target = meshes[2].position.clone();
      if (sim.mode === "flight") {
        flightBounds.makeEmpty();
        meshes.forEach((mesh) => {
          mesh.updateMatrixWorld();
          flightBounds.expandByObject(mesh);
        });
        flightBounds.getCenter(target);
      }
      target.x -= innerWidth < 700 ? 0 : 2.3;
      target.y -= 0.5;
      const followRate = sim.flightControl === "manual" ? 2.5 : 1.5;
      const shift = target
        .sub(controls.target)
        .multiplyScalar(1 - Math.exp(-dt * followRate));
      controls.target.add(shift);
      camera.position.add(shift);
    }
    if (grabPointer === null && !resetTransition) controls.update();
    renderer.render(scene, camera);
    if ((uiTime += dt) > 0.25) {
      updateAutopilotCountdown();
      const p = sim.bodies[2].getPosition(),
        v = sim.bodies[2].getLinearVelocity();
      $("telemetry").textContent =
        `${Math.max(0, p.y - manifest.parts[2].center[1]).toFixed(1)} m altitude · ${Math.hypot(v.x, v.y, v.z).toFixed(1)} m/s`;
      if (!paused && sim.mode === "flight")
        $("mode-label").textContent = flightStatus();
      if (!paused && !grabMode && sim.mode === "drop")
        $("mode-label").textContent = dropStatus();
      uiTime = 0;
    }
  }
  renderer.setAnimationLoop(animate);
  addEventListener(
    "pagehide",
    (event) => {
      if (event.persisted) return;
      renderer.setAnimationLoop(null);
      sim.dispose();
      controls.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
      });
      material.dispose();
      grabMaterial.dispose();
      tetherMaterial.dispose();
      grabMarker.material.dispose();
      contactShadows.forEach((shadow) => shadow.material.dispose());
      contactTexture.dispose();
      env.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}
start().catch((error) => {
  console.error(error);
  $("error").hidden = false;
  $("error").textContent =
    `The scene could not start: ${error.message}. Please reload in a browser with WebGL2 and WebAssembly support.`;
  $("mode-label").textContent = "UNAVAILABLE";
  $("telemetry").textContent = "Loading failed";
});
