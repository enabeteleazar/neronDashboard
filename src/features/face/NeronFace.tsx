import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import type { VRM } from "@pixiv/three-vrm";
import { makeHologram } from "./hologram";
import "./NeronFace.css";

export type FaceState = "idle" | "thinking" | "working" | "alert";

const COLOR: Record<FaceState, string> = {
  idle: "#7fc4ff",
  thinking: "#a892ff",
  working: "#5ee7ff",
  alert: "#ff6b6b",
};

const MODEL = import.meta.env.BASE_URL + "neron-avatar.vrm";

const DEG = Math.PI / 180;
const ARM = -75 * DEG;   // ouverture des bras : 90 = T-pose, 0 = colles au corps

/** Sort le modele de la T-pose. */
function restPose(vrm: any) {
  const set = (name: string, x = 0, y = 0, z = 0) => {
    const o = vrm.humanoid?.getNormalizedBoneNode(name);
    if (o) o.rotation.set(x, y, z);
  };
  set("leftShoulder", 0, 0, -3 * DEG);
  set("rightShoulder", 0, 0, 3 * DEG);
  set("leftUpperArm", 0, 0, -ARM);
  set("rightUpperArm", 0, 0, ARM);
  set("leftLowerArm", 0, -12 * DEG, -12 * DEG);
  set("rightLowerArm", 0, 12 * DEG, 12 * DEG);
  set("leftHand", 0, 0, -6 * DEG);
  set("rightHand", 0, 0, 6 * DEG);
}

type Pointer = { x: number; y: number; t: number };

function Head({
  state,
  level,
  color,
  pointer,
}: {
  state: FaceState;
  level: number;
  color: string;
  pointer: React.MutableRefObject<Pointer>;
}) {
  const lookTarget = useMemo(() => new THREE.Object3D(), []);
  const gaze = useRef(new THREE.Vector2());
  const saccade = useRef(new THREE.Vector2());
  const nextSaccade = useRef(0);
  const gltf = useGLTF(MODEL, undefined, undefined, (loader: any) =>
    loader.register((parser: any) => new VRMLoaderPlugin(parser))
  ) as any;
  const vrm = gltf?.userData?.vrm as VRM | undefined;

  const t = useRef(0);
  const blink = useRef(0);
  const nextBlink = useRef(2);
  const mouth = useRef(0);

  /* VRM 0.x nomme ses blendshapes a/i/u/e/o : on resout le nom reellement present */
  const names = useMemo(() => {
    const em: any = vrm?.expressionManager;
    const has = (n: string) => !!em?.getExpression?.(n);
    return {
      blink: ["blink", "Blink"].find(has) ?? "blink",
      mouth: ["aa", "a", "A"].find(has) ?? "aa",
    };
  }, [vrm]);

  useEffect(() => {
    if (!vrm) return;
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.updateMatrixWorld(true);
    const head = vrm.humanoid?.getNormalizedBoneNode("head");
    if (head) {
      const p = new THREE.Vector3();
      head.getWorldPosition(p);
      vrm.scene.position.sub(p);
    }
    restPose(vrm);
    if (vrm.lookAt) vrm.lookAt.target = lookTarget;
    vrm.scene.traverse((o: any) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        o.material = makeHologram(o.material, color);
      }
    });
  }, [vrm, color]);

  useFrame((_, dt) => {
    if (!vrm) return;
    t.current += dt;
    const now = t.current;

    if (now > nextBlink.current) {
      const p = (now - nextBlink.current) / 0.16;
      if (p >= 1) {
        blink.current = 0;
        nextBlink.current = now + 2 + Math.random() * 5;
      } else {
        blink.current = Math.sin(p * Math.PI);
      }
    }

    const synth =
      state === "working"
        ? Math.max(0, 0.45 + 0.35 * Math.sin(now * 11) + 0.25 * Math.sin(now * 6.7))
        : 0;
    const target = Math.min(1, level > 0 ? level : synth);
    mouth.current += (target - mouth.current) * Math.min(1, dt * 14);

    const em: any = vrm.expressionManager;
    em?.setValue(names.blink, blink.current);
    em?.setValue(names.mouth, mouth.current * 0.8);

    const sway = Math.sin(now * 0.6) * 0.035;
    const lu = vrm.humanoid?.getNormalizedBoneNode("leftUpperArm");
    const ru = vrm.humanoid?.getNormalizedBoneNode("rightUpperArm");
    if (lu) lu.rotation.z = -ARM + sway;
    if (ru) ru.rotation.z = ARM - sway;
    const chest =
      vrm.humanoid?.getNormalizedBoneNode("chest") ??
      vrm.humanoid?.getNormalizedBoneNode("spine");
    if (chest) chest.rotation.x = Math.sin(now * 0.8) * 0.02;

    const wall = performance.now() / 1000;
    const active = wall - pointer.current.t < 4;
    const gx = active ? pointer.current.x * 2 : Math.sin(now * 0.35) * 0.22;
    const gy = active ? pointer.current.y * 2 : Math.sin(now * 0.27) * 0.14;

    if (wall > nextSaccade.current) {
      nextSaccade.current = wall + 0.3 + Math.random() * 0.9;
      saccade.current.set((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.035);
    }

    const k = Math.min(1, dt * 5);
    gaze.current.x += (gx + saccade.current.x - gaze.current.x) * k;
    gaze.current.y += (gy + saccade.current.y - gaze.current.y) * k;

    lookTarget.position.set(gaze.current.x * 0.5, 0.05 + gaze.current.y * 0.35, 1.0);

    const head = vrm.humanoid?.getNormalizedBoneNode("head");
    if (head) {
      head.rotation.y = THREE.MathUtils.clamp(gaze.current.x * 0.45, -0.5, 0.5);
      head.rotation.x = THREE.MathUtils.clamp(-gaze.current.y * 0.3, -0.3, 0.3);
    }

    vrm.update(dt);
  });

  return vrm ? (
    <>
      <primitive object={vrm.scene} />
      <primitive object={lookTarget} />
    </>
  ) : null;
}

export function NeronFace({
  state = "idle",
  level = 0,
}: {
  state?: FaceState;
  level?: number;
}) {
  const pointer = useRef<Pointer>({ x: 0, y: 0, t: -99 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = e.clientX / window.innerWidth - 0.5;
      pointer.current.y = e.clientY / window.innerHeight - 0.5;
      pointer.current.t = performance.now() / 1000;
    };
    const onLeave = () => {
      pointer.current.t = -99;
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return (
    <div className="neron-face" style={{ ["--accent" as any]: COLOR[state] }}>
      <div className="neron-face__halo" />
      <Canvas
        camera={{ position: [0, 0.05, 2.25], fov: 24 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1} />
        <Suspense fallback={null}>
          <Head state={state} level={level} color={COLOR[state]} pointer={pointer} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default NeronFace;
