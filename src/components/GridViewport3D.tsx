import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { keyOf } from '../game/engine';
import {
  CellKey,
  Coord,
  SIZE_X,
  SIZE_Y,
  SIZE_Z,
  SPACING,
  TrackSegment,
} from '../game/types';

export interface ActiveSlideSegment {
  from: Coord;
  to: Coord;
  startedAt: number;
  durationMs: number;
}

export interface GridViewportProps {
  startCell: Coord;
  yellowSet: Set<CellKey>;
  visitedSet: Set<CellKey>;
  numbersMap: Map<CellKey, number>;
  redSet: Set<CellKey>;
  currentPos: Coord;
  trackSegments: TrackSegment[];
  activeSlide: ActiveSlideSegment | null;
  previewPath: Coord[] | null;
  resetViewNonce: number;
  autoOrbit: boolean;
}

const GRID_CENTER = new THREE.Vector3(
  ((SIZE_X - 1) / 2) * SPACING,
  ((SIZE_Z - 1) / 2) * SPACING,
  -((SIZE_Y - 1) / 2) * SPACING
);

const DEFAULT_LOOK_TARGET = new THREE.Vector3(
  GRID_CENTER.x,
  GRID_CENTER.y - 0.85,
  GRID_CENTER.z
);

const DEFAULT_DIST = 15.2 * SPACING;
const DEFAULT_YAW_RAD = (35 * Math.PI) / 180;
const DEFAULT_PITCH_RAD = (22 * Math.PI) / 180;

const DEFAULT_CAM_POS = new THREE.Vector3(
  DEFAULT_LOOK_TARGET.x -
    DEFAULT_DIST * Math.cos(DEFAULT_PITCH_RAD) * Math.sin(DEFAULT_YAW_RAD),
  DEFAULT_LOOK_TARGET.y + DEFAULT_DIST * Math.sin(DEFAULT_PITCH_RAD),
  DEFAULT_LOOK_TARGET.z +
    DEFAULT_DIST * Math.cos(DEFAULT_PITCH_RAD) * Math.cos(DEFAULT_YAW_RAD)
);

function gridToWorld(p: Coord, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(p[0] * SPACING, p[2] * SPACING, -p[1] * SPACING);
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createNumberTexture(
  value: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 42, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 16, 32, 0.82)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ef4444';
  ctx.stroke();

  ctx.font = '700 62px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff5a5a';
  ctx.fillText(String(value), size / 2, size / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecMid = new THREE.Vector3();
const _vecDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

function alignCylinderBetween(
  mesh: THREE.Mesh,
  a: THREE.Vector3,
  b: THREE.Vector3
): void {
  const dist = a.distanceTo(b);
  if (dist < 0.001) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  _vecMid.addVectors(a, b).multiplyScalar(0.5);
  _vecDir.subVectors(b, a).normalize();
  _quat.setFromUnitVectors(_upAxis, _vecDir);
  mesh.position.copy(_vecMid);
  mesh.quaternion.copy(_quat);
  mesh.scale.set(1, dist, 1);
}

export function GridViewport3D(props: GridViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const propsRef = useRef(props);
  propsRef.current = props;

  const sceneSyncRef = useRef<(() => void) | null>(null);
  const cameraResetRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      onContextRestored
    );

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060d1f);
    scene.fog = new THREE.FogExp2(0x060d1f, 0.0085);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      40,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      240
    );
    camera.position.copy(DEFAULT_CAM_POS);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(DEFAULT_LOOK_TARGET);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enablePan = true;
    controls.minDistance = 8;
    controls.maxDistance = 72;
    controls.update();

    // Lighting rig
    const hemiLight = new THREE.HemisphereLight(0xcbe5ff, 0x0b162c, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.45);
    keyLight.position.set(18, 28, 22);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.75);
    rimLight.position.set(-18, -10, -24);
    scene.add(rimLight);

    // Subtle ground reference grid beneath layer 0
    const floorGridSize = Math.max(SIZE_X, SIZE_Y) * SPACING;
    const floorGrid = new THREE.GridHelper(
      floorGridSize + 2.4,
      SIZE_X + 2,
      0x1e3a5f,
      0x0f213d
    );
    floorGrid.position.set(GRID_CENTER.x, -1.35, GRID_CENTER.z);
    scene.add(floorGrid);

    // Small corner axis triad near (0, 0, 0) so directions Phải(+X), Lên(+Y), Tiến(-Z) stay readable
    const axisGroup = new THREE.Group();
    axisGroup.position.set(-1.3, -1.15, 1.3);
    const axisLen = 1.6;
    const makeAxis = (dir: THREE.Vector3, colorHex: number) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        dir.clone().multiplyScalar(axisLen),
      ]);
      const mat = new THREE.LineBasicMaterial({ color: colorHex });
      return new THREE.Line(geo, mat);
    };
    axisGroup.add(makeAxis(new THREE.Vector3(1, 0, 0), 0x38bdf8)); // +X Phải
    axisGroup.add(makeAxis(new THREE.Vector3(0, 1, 0), 0x4ade80)); // +Y Lên
    axisGroup.add(makeAxis(new THREE.Vector3(0, 0, -1), 0xfbbf24)); // -Z Tiến
    scene.add(axisGroup);

    // Shared cell geometries & pooled PBR materials
    const cellGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    const edgeGeo = new THREE.EdgesGeometry(cellGeo);

    const cellMats = {
      unvisited: new THREE.MeshStandardMaterial({
        color: 0x7c93b8,
        roughness: 0.38,
        metalness: 0.1,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
      visited: new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        emissive: 0x1d4ed8,
        emissiveIntensity: 0.24,
        roughness: 0.26,
        metalness: 0.18,
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
      }),
      start: new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x15803d,
        emissiveIntensity: 0.34,
        roughness: 0.24,
        metalness: 0.18,
        transparent: true,
        opacity: 0.86,
        depthWrite: true,
      }),
      yellow: new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.32,
        roughness: 0.24,
        metalness: 0.22,
        transparent: true,
        opacity: 0.88,
        depthWrite: true,
      }),
      red: new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.42,
        roughness: 0.3,
        metalness: 0.25,
        transparent: true,
        opacity: 0.94,
        depthWrite: true,
      }),
    };

    const edgeMats = {
      unvisited: new THREE.LineBasicMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.26,
      }),
      visited: new THREE.LineBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.6,
      }),
      start: new THREE.LineBasicMaterial({
        color: 0x86efac,
        transparent: true,
        opacity: 0.85,
      }),
      yellow: new THREE.LineBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.85,
      }),
      red: new THREE.LineBasicMaterial({
        color: 0xfca5a5,
        transparent: true,
        opacity: 0.92,
      }),
      current: new THREE.LineBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 1,
      }),
    };

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const numberTextures = new Map<number, THREE.CanvasTexture>();
    const numberSpriteMats = new Map<number, THREE.SpriteMaterial>();
    for (let v = 1; v <= 4; v++) {
      const tex = createNumberTexture(v, maxAnisotropy);
      numberTextures.set(v, tex);
      numberSpriteMats.set(
        v,
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        })
      );
    }

    // Build 192 grid cell objects
    const cellRecords = new Map<
      CellKey,
      {
        coord: Coord;
        mesh: THREE.Mesh;
        edges: THREE.LineSegments;
        sprite: THREE.Sprite;
      }
    >();

    for (let i = 0; i < SIZE_X; i++) {
      for (let j = 0; j < SIZE_Y; j++) {
        for (let k = 0; k < SIZE_Z; k++) {
          const coord: Coord = [i, j, k];
          const key = keyOf(coord);
          const worldPos = gridToWorld(coord);

          const mesh = new THREE.Mesh(cellGeo, cellMats.unvisited);
          mesh.position.copy(worldPos);
          scene.add(mesh);

          const edges = new THREE.LineSegments(edgeGeo, edgeMats.unvisited);
          mesh.add(edges);

          const sprite = new THREE.Sprite(numberSpriteMats.get(1)!);
          sprite.position.copy(worldPos);
          sprite.scale.set(1.18, 1.18, 1);
          sprite.renderOrder = 25;
          sprite.visible = false;
          scene.add(sprite);

          cellRecords.set(key, { coord, mesh, edges, sprite });
        }
      }
    }

    // Composite 4-part 3D Player Beacon
    const playerGroup = new THREE.Group();
    const coreGeo = new THREE.IcosahedronGeometry(0.28, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xff9f1c,
      emissive: 0xf97316,
      emissiveIntensity: 1.35,
      roughness: 0.18,
      metalness: 0.25,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.renderOrder = 30;
    playerGroup.add(coreMesh);

    const outerRingGeo = new THREE.TorusGeometry(0.42, 0.042, 12, 32);
    const outerRingMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.75,
      roughness: 0.15,
      metalness: 0.85,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = Math.PI / 2;
    playerGroup.add(outerRing);

    const innerRingGeo = new THREE.TorusGeometry(0.35, 0.03, 10, 28);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.2,
      metalness: 0.9,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.y = Math.PI / 4;
    playerGroup.add(innerRing);

    const spireGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.78, 10);
    const spireMesh = new THREE.Mesh(spireGeo, innerRingMat);
    playerGroup.add(spireMesh);

    scene.add(playerGroup);

    // Track beams group
    const trackGroup = new THREE.Group();
    scene.add(trackGroup);
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 10);
    const jointGeo = new THREE.SphereGeometry(0.115, 12, 12);
    const beamMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.35,
    });

    const activeBeamMesh = new THREE.Mesh(beamGeo, beamMat);
    activeBeamMesh.visible = false;
    activeBeamMesh.renderOrder = 15;
    scene.add(activeBeamMesh);

    // Preview trajectory ghosts
    const previewGroup = new THREE.Group();
    scene.add(previewGroup);
    const previewBoxGeo = new THREE.BoxGeometry(1.12, 1.12, 1.12);
    const previewEdgeGeo = new THREE.EdgesGeometry(previewBoxGeo);
    const previewLineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
    });
    const previewStopMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });

    let committedMeshes: THREE.Mesh[] = [];

    const syncSceneState = () => {
      const {
        startCell,
        yellowSet,
        visitedSet,
        numbersMap,
        redSet,
        currentPos,
        trackSegments,
        activeSlide,
        previewPath,
      } = propsRef.current;

      const startKey = keyOf(startCell);
      const currentKey = keyOf(currentPos);

      for (const [k, rec] of cellRecords.entries()) {
        let matKey: keyof typeof cellMats = 'unvisited';
        if (redSet.has(k)) {
          matKey = 'red';
        } else if (k === startKey) {
          matKey = 'start';
        } else if (yellowSet.has(k)) {
          matKey = 'yellow';
        } else if (visitedSet.has(k) && !numbersMap.has(k)) {
          matKey = 'visited';
        }

        rec.mesh.material = cellMats[matKey];
        rec.edges.material =
          k === currentKey ? edgeMats.current : edgeMats[matKey];

        if (numbersMap.has(k) && !redSet.has(k)) {
          const val = Math.max(1, Math.min(4, numbersMap.get(k)!));
          rec.sprite.material = numberSpriteMats.get(val)!;
          rec.sprite.visible = true;
        } else {
          rec.sprite.visible = false;
        }
      }

      // Rebuild committed track segments
      for (const m of committedMeshes) {
        trackGroup.remove(m);
      }
      committedMeshes = [];

      const jointKeys = new Set<string>();
      for (const seg of trackSegments) {
        gridToWorld(seg.from, _vecA);
        gridToWorld(seg.to, _vecB);
        const cyl = new THREE.Mesh(beamGeo, beamMat);
        alignCylinderBetween(cyl, _vecA, _vecB);
        cyl.renderOrder = 14;
        trackGroup.add(cyl);
        committedMeshes.push(cyl);

        for (const pt of [seg.from, seg.to]) {
          const pk = keyOf(pt);
          if (!jointKeys.has(pk)) {
            jointKeys.add(pk);
            const jMesh = new THREE.Mesh(jointGeo, beamMat);
            gridToWorld(pt, jMesh.position);
            jMesh.renderOrder = 14;
            trackGroup.add(jMesh);
            committedMeshes.push(jMesh);
          }
        }
      }

      // Update preview path ghosts
      while (previewGroup.children.length > 0) {
        previewGroup.remove(previewGroup.children[0]);
      }
      if (previewPath && previewPath.length > 0) {
        previewPath.forEach((coord, idx) => {
          const wp = gridToWorld(coord);
          const outline = new THREE.LineSegments(previewEdgeGeo, previewLineMat);
          outline.position.copy(wp);
          previewGroup.add(outline);

          if (idx === previewPath.length - 1) {
            const cap = new THREE.Mesh(previewBoxGeo, previewStopMat);
            cap.position.copy(wp);
            previewGroup.add(cap);
          }
        });
      }

      if (!activeSlide) {
        gridToWorld(currentPos, playerGroup.position);
        activeBeamMesh.visible = false;
      }
    };

    sceneSyncRef.current = syncSceneState;
    syncSceneState();

    // Camera transition state (cancelled if user interacts)
    let camResetActive = false;
    controls.addEventListener('start', () => {
      camResetActive = false;
    });

    cameraResetRef.current = () => {
      camResetActive = true;
    };

    // Resize observer
    const handleResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Frame loop
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Rotate player beacon rings smoothly
      outerRing.rotation.z = elapsed * 1.4;
      innerRing.rotation.x = elapsed * 1.8;
      innerRing.rotation.y = elapsed * 1.1;

      const { activeSlide, autoOrbit } = propsRef.current;

      if (activeSlide) {
        const t = Math.min(
          1,
          Math.max(0, (performance.now() - activeSlide.startedAt) / activeSlide.durationMs)
        );
        gridToWorld(activeSlide.from, _vecA);
        gridToWorld(activeSlide.to, _vecB);
        playerGroup.position.lerpVectors(_vecA, _vecB, t);
        alignCylinderBetween(activeBeamMesh, _vecA, playerGroup.position);
      } else {
        activeBeamMesh.visible = false;
      }

      if (camResetActive) {
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          DEFAULT_CAM_POS.x,
          8,
          delta
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          DEFAULT_CAM_POS.y,
          8,
          delta
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          DEFAULT_CAM_POS.z,
          8,
          delta
        );
        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          DEFAULT_LOOK_TARGET.x,
          8,
          delta
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          DEFAULT_LOOK_TARGET.y,
          8,
          delta
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          DEFAULT_LOOK_TARGET.z,
          8,
          delta
        );
        if (
          camera.position.distanceTo(DEFAULT_CAM_POS) < 0.03 &&
          controls.target.distanceTo(DEFAULT_LOOK_TARGET) < 0.03
        ) {
          camera.position.copy(DEFAULT_CAM_POS);
          controls.target.copy(DEFAULT_LOOK_TARGET);
          camResetActive = false;
        }
      }

      controls.autoRotate = autoOrbit && !isSoftwareGl;
      controls.autoRotateSpeed = 0.8;
      controls.update();

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      tick();
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.dispose();

      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        onContextRestored
      );

      cellGeo.dispose();
      edgeGeo.dispose();
      coreGeo.dispose();
      outerRingGeo.dispose();
      innerRingGeo.dispose();
      spireGeo.dispose();
      beamGeo.dispose();
      jointGeo.dispose();
      previewBoxGeo.dispose();
      previewEdgeGeo.dispose();

      Object.values(cellMats).forEach((m) => m.dispose());
      Object.values(edgeMats).forEach((m) => m.dispose());
      coreMat.dispose();
      outerRingMat.dispose();
      innerRingMat.dispose();
      beamMat.dispose();
      previewLineMat.dispose();
      previewStopMat.dispose();

      numberTextures.forEach((t) => t.dispose());
      numberSpriteMats.forEach((m) => m.dispose());
      envTarget.dispose();

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    sceneSyncRef.current?.();
  }, [
    props.startCell,
    props.yellowSet,
    props.visitedSet,
    props.numbersMap,
    props.redSet,
    props.currentPos,
    props.trackSegments,
    props.activeSlide,
    props.previewPath,
  ]);

  useEffect(() => {
    if (props.resetViewNonce > 0) {
      cameraResetRef.current?.();
    }
  }, [props.resetViewNonce]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#060d1f] text-slate-200 p-6">
          <div className="max-w-md text-center space-y-2">
            <h2 className="font-display text-xl font-semibold text-cyan-300">
              Đang khôi phục khung cảnh 3D
            </h2>
            <p className="text-sm text-slate-400">
              Kết nối đồ họa WebGL tạm thời bị gián đoạn. Trình duyệt đang tự động khôi phục lại không gian lưới.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
