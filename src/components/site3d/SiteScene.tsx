/**
 * SiteScene — maquete 3D operacional do site (estilo consola de gestão de
 * energia, à semelhrança dos sistemas enterprise de TowerCo).
 *
 * Regras:
 *  - Geometria 100% procedural (torre em treliça, shelter, rectificador,
 *    baterias, gerador, câmara, vedação) — nenhum modelo externo.
 *  - Etiquetas ligadas a dados REAIS do site (UiTower); quando o backend
 *    não fornece o valor, mostra "N/A" — nunca um número inventado.
 *  - Cores por estado real: online / degradado / offline / desconhecido.
 *  - Nenhum import de React state-heavy: a cena é estática, apenas
 *    observável (rotação/zoom via OrbitControls).
 */
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import type { TowerStatus } from "@/lib/api";

export type SiteSceneData = {
  towerId: string;
  status: TowerStatus;
  batterySoc?: number;
  batterySoh?: number;
  dcVoltage?: number;
  dcCurrent?: number;
  generatorFuel?: number;
  generatorStatus?: string;
  signalRssi?: number;
};

const STATUS_COLORS: Record<TowerStatus, string> = {
  online: "#2fa56b",
  degraded: "#d99a2b",
  offline: "#d64545",
};
const UNKNOWN = "#8a94a6";

const NA = "N/A";

function num(v: number | undefined, unit: string): string {
  return v === undefined || Number.isNaN(v) ? NA : `${Math.round(v)}${unit}`;
}

function Label({
  title,
  rows,
  status,
  position,
}: {
  title: string;
  rows: [string, string][];
  status?: TowerStatus;
  position: [number, number, number];
}) {
  const dot = status ? STATUS_COLORS[status] : UNKNOWN;
  return (
    <Html position={position} center distanceFactor={14} zIndexRange={[10, 0]}>
      <div className="noc-3d-label">
        <div className="flex items-center gap-1.5 font-semibold">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: dot }} />
          {title}
        </div>
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2 justify-between">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-mono">{v}</span>
          </div>
        ))}
      </div>
    </Html>
  );
}

function LatticeTower({ color }: { color: string }) {
  const legs: React.ReactElement[] = [];
  const base = 2.2;
  const top = 0.5;
  const height = 14;
  const levels = 7;
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    legs.push(
      <mesh
        key={`leg-${dx}-${dz}`}
        position={[(dx * base) / 2, height / 2, (dz * base) / 2]}
        rotation={[0, 0, 0]}
      >
        <cylinderGeometry args={[0.05, 0.07, height, 6]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>,
    );
  }
  const bars: React.ReactElement[] = [];
  for (let i = 1; i <= levels; i++) {
    const t = i / levels;
    const w = (base + (top - base) * t) / 2;
    const y = (height * i) / levels;
    bars.push(
      <group key={`bar-${i}`}>
        {[-w, w].map((x, j) => (
          <mesh key={`x-${j}`} position={[x, y, 0]}>
            <boxGeometry args={[0.05, 0.05, w * 2]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        {[-w, w].map((z, j) => (
          <mesh key={`z-${j}`} position={[0, y, z]}>
            <boxGeometry args={[w * 2, 0.05, 0.05]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
      </group>,
    );
  }
  return (
    <group position={[0, 0, 0]}>
      {legs}
      {bars}
      {/* Antena sectorial no topo */}
      <mesh position={[1.4, height + 1.2, 0]}>
        <boxGeometry args={[0.3, 2.2, 0.12]} />
        <meshStandardMaterial color="#e8ecf2" />
      </mesh>
      <mesh position={[-1.4, height + 1.2, 0]}>
        <boxGeometry args={[0.3, 2.2, 0.12]} />
        <meshStandardMaterial color="#e8ecf2" />
      </mesh>
      {/* Microwave link */}
      <mesh position={[0, height + 2.6, 0.4]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.12, 24]} />
        <meshStandardMaterial color="#dfe5ee" />
      </mesh>
    </group>
  );
}

function Shelter({ color }: { color: string }) {
  return (
    <group position={[-5, 0, 2]}>
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[4.2, 2.5, 2.6]} />
        <meshStandardMaterial color="#dfe5ee" roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.62, 0]}>
        <boxGeometry args={[4.5, 0.12, 2.9]} />
        <meshStandardMaterial color="#b7c0cc" />
      </mesh>
      {/* Porta */}
      <mesh position={[0.9, 1.1, 1.32]}>
        <boxGeometry args={[0.9, 2, 0.04]} />
        <meshStandardMaterial color="#c3cad4" />
      </mesh>
      {/* Unidade de ar condicionado */}
      <mesh position={[-1.6, 1.4, 1.35]}>
        <boxGeometry args={[0.7, 0.7, 0.25]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function RectifierGroup({ color }: { color: string }) {
  return (
    <group position={[3.4, 0, 3.2]}>
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[1.8, 1.3, 0.9]} />
        <meshStandardMaterial color="#dfe5ee" roughness={0.6} />
      </mesh>
      {/* módulos rectificador */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.55 + i * 0.55, 0.65, 0.46]}>
          <boxGeometry args={[0.42, 0.9, 0.05]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function BatteryGroup({ color }: { color: string }) {
  return (
    <group position={[3.6, 0, 0.6]}>
      {[0, 1].map((i) => (
        <mesh key={i} position={[0, 0.35, i * 0.85]}>
          <boxGeometry args={[1.3, 0.7, 0.7]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Generator({ color }: { color: string }) {
  return (
    <group position={[5.2, 0, -2.6]} rotation={[0, -0.5, 0]}>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[3, 1.5, 1.4]} />
        <meshStandardMaterial color="#d9b23a" roughness={0.55} />
      </mesh>
      <mesh position={[0.9, 1.85, -0.2]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.9, 10]} />
        <meshStandardMaterial color="#3a3f47" />
      </mesh>
      {/* Depósito de combustível */}
      <mesh position={[-2.4, 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.6, 0.6, 1.6, 20]} />
        <meshStandardMaterial color="#4a5a4a" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0]} visible={false}>
        <boxGeometry args={[0, 0, 0]} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[3.4, 0.04, 1.8]} />
        <meshStandardMaterial color="#9aa3ad" />
      </mesh>
      <group visible={false}>{color}</group>
    </group>
  );
}

function CameraPole() {
  return (
    <group position={[-4.4, 0, -3.4]}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 3, 8]} />
        <meshStandardMaterial color="#7d8794" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0.15, 3, 0]} rotation={[0, 0.6, 0]}>
        <boxGeometry args={[0.35, 0.16, 0.2]} />
        <meshStandardMaterial color="#2c313a" />
      </mesh>
      {/* Cone de visão */}
      <mesh position={[1.1, 2.72, 0.75]} rotation={[0, 0.6, 0]}>
        <coneGeometry args={[0.9, 2.2, 24, 1, true]} />
        <meshStandardMaterial color="#7fb0ff" transparent opacity={0.12} side={2} />
      </mesh>
    </group>
  );
}

function Fence() {
  const w = 18;
  const d = 14;
  const mat = <meshStandardMaterial color="#98a2ae" transparent opacity={0.35} side={2} />;
  const posts = <meshStandardMaterial color="#6b7480" />;
  return (
    <group>
      <mesh position={[0, 0.9, -d / 2]}>
        <boxGeometry args={[w, 1.8, 0.02]} />
        {mat}
      </mesh>
      <mesh position={[0, 0.9, d / 2]}>
        <boxGeometry args={[w, 1.8, 0.02]} />
        {mat}
      </mesh>
      <mesh position={[-w / 2, 0.9, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[d, 1.8, 0.02]} />
        {mat}
      </mesh>
      <mesh position={[w / 2, 0.9, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[d, 1.8, 0.02]} />
        {mat}
      </mesh>
      {[-w / 2, -w / 6, w / 6, w / 2].map((x) => (
        <mesh key={`p-${x}`} position={[x, 0.95, -d / 2]}>
          <boxGeometry args={[0.08, 1.9, 0.08]} />
          {posts}
        </mesh>
      ))}
    </group>
  );
}

export default function SiteScene({ data }: { data: SiteSceneData }) {
  const ok = STATUS_COLORS[data.status] ?? UNKNOWN;
  const battColor = data.batterySoc === undefined ? UNKNOWN : data.batterySoc >= 60 ? ok : data.batterySoc >= 30 ? STATUS_COLORS.degraded : STATUS_COLORS.offline;
  const genColor = data.generatorStatus === undefined ? UNKNOWN : data.generatorStatus === "erro" ? STATUS_COLORS.offline : data.generatorStatus === "ligado" ? STATUS_COLORS.degraded : STATUS_COLORS.online;
  const rectColor = data.dcVoltage === undefined ? UNKNOWN : STATUS_COLORS.online;

  return (
    <Canvas
      camera={{ position: [16, 12, 16], fov: 42 }}
      dpr={[1, 1.5]}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#10141b"]} />
      <fog attach="fog" args={["#10141b", 40, 90]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[12, 18, 8]} intensity={1.4} />
      <directionalLight position={[-10, 8, -12]} intensity={0.4} color="#9db4d6" />

      {/* Terreno laterite + pad de gravilha */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#7c4630" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[17, 13]} />
        <meshStandardMaterial color="#8f7f72" />
      </mesh>

      <LatticeTower color={ok} />
      <Shelter color={ok} />
      <RectifierGroup color={rectColor} />
      <BatteryGroup color={battColor} />
      <Generator color={genColor} />
      <CameraPole />
      <Fence />

      <Label
        title="TORRE"
        status={data.status}
        position={[0, 18.5, 0]}
        rows={[
          ["Estado", data.status],
          ["RSSI", data.signalRssi !== undefined ? `${data.signalRssi} dBm` : NA],
        ]}
      />
      <Label
        title="BATTERY GROUP"
        position={[-5, 4.6, 2]}
        rows={[
          ["SoC", num(data.batterySoc, "%")],
          ["SoH", num(data.batterySoh, "%")],
        ]}
      />
      <Label
        title="RECTIFIER GROUP"
        position={[3.4, 3.4, 3.2]}
        rows={[
          ["DC Power", num(data.dcVoltage, " V")],
          ["Corrente", num(data.dcCurrent, " A")],
        ]}
      />
      <Label
        title="GERADOR + ATS"
        position={[5.2, 3.6, -2.6]}
        rows={[
          ["Estado", data.generatorStatus ?? NA],
          ["Combustível", num(data.generatorFuel, "%")],
        ]}
      />
      <Label
        title="CÂMARA"
        position={[-4.4, 4.4, -3.4]}
        rows={[["Feed", NA]]}
      />

      <OrbitControls
        target={[0, 3, 0]}
        minDistance={8}
        maxDistance={45}
        maxPolarAngle={Math.PI / 2.15}
        enablePan={false}
      />
    </Canvas>
  );
}
