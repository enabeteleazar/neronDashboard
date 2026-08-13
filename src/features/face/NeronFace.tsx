import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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

const FIT = 1.02;   // marge autour de l'avatar : 1 = colle aux bords
const FIT_BUST = 1.30;  // marge en mode buste : plus grand = plus de recul
const DEG = Math.PI / 180;
const ARM = -80 * DEG;   // ouverture des bras : 90 = T-pose, 0 = colles au corps

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
  bust,
}: {
  state: FaceState;
  level: number;
  color: string;
  pointer: React.MutableRefObject<Pointer>;
  bust: boolean;
}) {
  const rig = useRef<THREE.Group>(null);
  const lookTarget = useMemo(() => new THREE.Object3D(), []);
  const gaze = useRef(new THREE.Vector2());
  const saccade = useRef(new THREE.Vector2());
  const nextSaccade = useRef(0);
  const gltf = useGLTF(MODEL, undefined, undefined, (loader: any) =>
    loader.register((parser: any) => new VRMLoaderPlugin(parser))
  ) as any;
  const vrm = gltf?.userData?.vrm as VRM | undefined;

  const { camera, size } = useThree();
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

  /* Cadre la camera : corps entier, ou buste quand l'avatar est dans la sidebar. */
  useEffect(() => {
    if (!vrm) return;
    const cam = camera as THREE.PerspectiveCamera;
    const half = Math.tan((cam.fov * DEG) / 2);
    const c = new THREE.Vector3();
    let sx = 0;
    let sy = 0;

    if (bust) {
      /* on ne passe PAS par Box3 : sur un SkinnedMesh la boite est calculee
         en pose de repos, donc inutilisable pour un cadrage serre. */
      const bone = (n: string) => vrm.humanoid?.getNormalizedBoneNode(n as any);
      const top = bone("head");
      const low = bone("upperChest") ?? bone("chest") ?? bone("spine");
      if (!top || !low) return;
      vrm.scene.updateMatrixWorld(true);
      const a = top.getWorldPosition(new THREE.Vector3());
      const b = low.getWorldPosition(new THREE.Vector3());
      sy = Math.abs(a.y - b.y) * 2.6;      // tete + epaules + haut du torse
      sx = sy * 0.8;
      c.set(a.x, a.y - sy * 0.16, a.z);    // visage legerement au-dessus du centre
    } else {
      const box = new THREE.Box3().setFromObject(vrm.scene);
      if (box.isEmpty()) return;
      box.getCenter(c);
      const s = box.getSize(new THREE.Vector3());
      sx = s.x;
      sy = s.y;
    }

    const fit = bust ? FIT_BUST : FIT;
    const dist = Math.max(
      (sy * fit) / 2 / half,
      (sx * fit) / 2 / half / cam.aspect,
    );
    cam.position.set(c.x, c.y, c.z + dist);
    cam.lookAt(c);
    cam.updateProjectionMatrix();
  }, [vrm, camera, bust, size.width, size.height]);

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
      <group ref={rig}>
        <primitive object={vrm.scene} />
      </group>
      <primitive object={lookTarget} />
    </>
  ) : null;
}

export function NeronFace({
  state = "idle",
  level = 0,
  bust = false,
  present = true,
}: {
  state?: FaceState;
  level?: number;
  bust?: boolean;
  /** Presence multi-appareils : false = estompe/reduit, JAMAIS demonte. */
  present?: boolean;
}) {
  const pointer = useRef<Pointer>({ x: 0, y: 0, t: -99 });
  const shell = useRef<HTMLDivElement>(null);
  const offset = useRef({ x: 0, y: 0 });
  const [docked, setDocked] = useState(false);
  const origin = useRef({ x: 0, y: 0 });   // centre du visage a l'ecran
  const dockedRef = useRef(false);

  /* Deplace l'avatar vers la plus grande zone libre a chaque ouverture/fermeture. */
  useEffect(() => {
    const el = shell.current;
    if (!el) return;
    const zoneEl = (el.closest(".orb-zone") as HTMLElement) ?? el.parentElement;
    if (!zoneEl) return;

    const place = () => {
      const z = zoneEl.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const baseX = r.left + r.width / 2 - offset.current.x;
      const baseY = r.top + r.height / 2 - offset.current.y;

      /* mode buste : on se pose sur l'emplacement vide de la sidebar */
      const slot = document.querySelector(".face-slot")?.getBoundingClientRect();
      const canDock = !!(bust && slot && slot.height >= 80 && slot.width >= 60);
      if (canDock !== dockedRef.current) {
        dockedRef.current = canDock;
        setDocked(canDock);
        schedule();            // remesure une fois la classe appliquee
        return;
      }
      if (bust && !canDock) return;   // slot introuvable : pas de repli au centre
      if (canDock && slot) {
        const next = {
          x: slot.left + slot.width / 2 - baseX,
          y: slot.top + slot.height / 2 - baseY,
        };
        offset.current = next;
        origin.current = { x: slot.left + slot.width / 2, y: slot.top + slot.height / 2 };
        el.style.transitionDuration = "0.45s";
        el.style.transform = `translate(${next.x}px, ${next.y}px)`;
        return;
      }

    };

    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(place, 80);
    };

    schedule();
    /* childList seulement : ne se declenche pas pendant le glissement d'une fenetre */
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);

    return () => {
      window.clearTimeout(timer);
      mo.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [bust]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      /* origine = le visage lui-meme, sinon l'avatar colle au bord gauche
         reste en butee de clamp des que le curseur passe a droite */
      const ox = origin.current.x || window.innerWidth / 2;
      const oy = origin.current.y || window.innerHeight / 2;
      pointer.current.x = (e.clientX - ox) / window.innerWidth;
      pointer.current.y = (e.clientY - oy) / window.innerHeight;
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
    <div
      ref={shell}
      className={[
        "neron-face",
        docked && "neron-face--bust",
        !present && "neron-face--hidden",
      ].filter(Boolean).join(" ")}
      style={{ ["--accent" as any]: COLOR[state] }}
    >
      <div className="neron-face__halo" />
      <Canvas
        camera={{ position: [0, -0.72, 3.0], fov: 30 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        /* Coupe completement la boucle de rendu quand cet appareil n'a pas
           la presence : sans ca, le VRM entier (os, regard, clignement)
           continue de tourner a plein regime pour un rendu invisible. */
        frameloop={present ? "always" : "never"}
      >
        <ambientLight intensity={1} />
        <Suspense fallback={null}>
          <Head state={state} level={level} color={COLOR[state]} pointer={pointer} bust={docked} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default NeronFace;
