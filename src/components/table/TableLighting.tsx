import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'

RectAreaLightUniformsLib.init()

/** A locally rendered billiard-room light rig; no remote HDR or asset requests. */
export function TableLighting() {
  return <>
    <ambientLight intensity={0.12} color="#e6ece9" />
    <hemisphereLight args={['#e4eff0', '#26352e', 0.38]} />
    <Environment resolution={256} frames={1} environmentIntensity={0.65}>
      <color attach="background" args={['#333b3b']} />
      {/* Broad ceiling diffuser, two narrow tubes, and a warm room-side fill. */}
      <Lightformer form="rect" position={[0, 3.5, -0.6]} scale={[3.8, 1.2, 1]} intensity={2} color="#fff9e9" />
      <Lightformer form="rect" position={[-0.7, 2.2, -1.1]} scale={[2.7, 0.14, 1]} intensity={6} color="#ffffff" />
      <Lightformer form="rect" position={[0.7, 2.4, 0.6]} scale={[2.7, 0.14, 1]} intensity={4} color="#edf6ff" />
      <Lightformer form="rect" position={[-3, 1.4, 1]} scale={[1.2, 2.3, 1]} intensity={1.1} color="#ead9bf" />
      <Lightformer form="rect" position={[3, 1.6, -1.4]} scale={[1.1, 2, 1]} intensity={1.4} color="#c6dce8" />
    </Environment>
    <rectAreaLight position={[0, 1.75, -0.12]} rotation={[-Math.PI / 2, 0, 0]} width={2.7} height={0.8} intensity={5} color="#fff9ed" />
    <directionalLight position={[-0.65, 4.5, -0.85]} intensity={1.35} color="#fff8e9" castShadow
      shadow-mapSize={[2048, 2048]} shadow-bias={-0.00008} shadow-normalBias={0.0004}
      shadow-radius={4} shadow-camera-left={-1.7} shadow-camera-right={1.7}
      shadow-camera-top={1.05} shadow-camera-bottom={-1.05} shadow-camera-near={0.5} shadow-camera-far={7} />
    <directionalLight position={[1.5, 2, 2]} intensity={0.3} color="#d7e9ef" />
    <ContactShadows position={[0, -0.147, 0]} scale={[3.65, 2.3]} far={0.45}
      opacity={0.55} blur={2.8} resolution={512} frames={1} color="#080c09" />
  </>
}
