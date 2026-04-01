// src/components/scenes/ScenesClient.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

const SCENES = [
  { id: 'celula',    emoji: '🧬', label: 'Célula eucariota',   desc: 'Orgánulos, membrana, núcleo y mitocondrias en 3D animado. Arrastra para rotar.' },
  { id: 'atomo',     emoji: '⚛️', label: 'Modelo atómico',     desc: 'Electrones orbitando el núcleo en niveles de energía. Modelo de Bohr clásico.' },
  { id: 'solar',     emoji: '🌌', label: 'Sistema solar',      desc: 'Planetas orbitando el sol a escala relativa. Arrastra para ver perspectiva.' },
  { id: 'adn',       emoji: '🧪', label: 'Doble hélice ADN',   desc: 'Estructura tridimensional del ácido desoxirribonucleico con pares de bases.' },
  { id: 'geometria', emoji: '📐', label: 'Geometría 3D',       desc: 'Sólidos platónicos: cubo, tetraedro y octaedro con wireframe interactivo.' },
  { id: 'volcan',    emoji: '🌋', label: 'Volcán (geología)',   desc: 'Modelo geológico de cámara magmática, chimenea y cráter volcánico.' },
]

export function ScenesClient() {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<any>(null)
  const frameRef    = useRef<number>(0)

  const [activeScene,  setActiveScene]  = useState('celula')
  const [aiTopic,      setAiTopic]      = useState('')
  const [aiResult,     setAiResult]     = useState('')
  const [aiLoading,    setAiLoading]    = useState(false)
  const [dragStart,    setDragStart]    = useState({ x: 0, y: 0 })
  const [rotation,     setRotation]     = useState({ y: 0, x: 0 })
  const isDragging = useRef(false)
  const rotRef     = useRef({ y: 0, x: 0 })

  useEffect(() => {
    let THREE: any
    let scene: any, camera: any, renderer: any, clock: any
    const animObjects: ((t: number) => void)[] = []

    async function init() {
      // Dynamically import three to avoid SSR issues
      THREE = (await import('three')).default ?? await import('three')

      const canvas = canvasRef.current
      if (!canvas) return
      const W = canvas.parentElement!.clientWidth
      const H = 400

      canvas.width  = W
      canvas.height = H

      if (rendererRef.current) {
        rendererRef.current.dispose()
        cancelAnimationFrame(frameRef.current)
      }

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x06050f, 1)
      rendererRef.current = renderer

      scene  = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200)
      camera.position.set(0, 2, 8)
      clock  = new THREE.Clock()

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.4))
      const dl = new THREE.DirectionalLight(0xa99bff, 1.2)
      dl.position.set(5, 8, 6)
      scene.add(dl)
      const dl2 = new THREE.DirectionalLight(0xf06292, 0.35)
      dl2.position.set(-4, -2, -4)
      scene.add(dl2)

      // Build scene
      animObjects.length = 0
      buildScene(THREE, scene, animObjects, activeScene)

      // Animate
      function animate() {
        frameRef.current = requestAnimationFrame(animate)
        const t = clock.getElapsedTime()
        animObjects.forEach(fn => fn(t))

        const r = 8
        camera.position.x = r * Math.sin(rotRef.current.y)
        camera.position.z = r * Math.cos(rotRef.current.y)
        camera.position.y = 2 + rotRef.current.x * 3
        camera.lookAt(0, 0, 0)

        renderer.render(scene, camera)
      }
      animate()
    }

    init()

    return () => {
      cancelAnimationFrame(frameRef.current)
      rendererRef.current?.dispose()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScene])

  function buildScene(THREE: any, scene: any, anims: ((t: number) => void)[], id: string) {
    switch (id) {
      case 'celula':    buildCelula(THREE, scene, anims);    break
      case 'atomo':     buildAtomo(THREE, scene, anims);     break
      case 'solar':     buildSolar(THREE, scene, anims);     break
      case 'adn':       buildADN(THREE, scene, anims);       break
      case 'geometria': buildGeometria(THREE, scene, anims); break
      case 'volcan':    buildVolcan(THREE, scene, anims);    break
    }
  }

  // ── MOUSE DRAG ─────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true
    setDragStart({ x: e.clientX, y: e.clientY })
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    rotRef.current.y += dx * 0.008
    rotRef.current.x = Math.max(-0.8, Math.min(0.8, rotRef.current.x + dy * 0.005))
    setDragStart({ x: e.clientX, y: e.clientY })
  }
  function onMouseUp() { isDragging.current = false }

  // ── AI EXPLAIN ──────────────────────────────────────────
  async function handleAiExplain() {
    const topic = aiTopic.trim() || (SCENES.find(s => s.id === activeScene)?.label ?? activeScene)
 
    setAiLoading(true)
    setAiResult('')
    try {
      const res = await fetch('/api/planificaciones/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, scene: activeScene }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAiResult(data.explanation)
    } catch (err: any) {
      toast.error(err.message ?? 'Error al generar explicación')
    } finally {
      setAiLoading(false)
    }
  }

  const currentScene = SCENES.find(s => s.id === activeScene)!

  return (
    <div>
      {/* Scene selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SCENES.map(s => (
          <button
            key={s.id}
            onClick={() => { rotRef.current = { y: 0, x: 0 }; setActiveScene(s.id); setAiResult('') }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              activeScene === s.id
                ? 'bg-[rgba(124,109,250,0.15)] border-[rgba(124,109,250,0.4)] text-violet2'
                : 'border-[rgba(120,100,255,0.14)] text-ink3 hover:text-ink2 hover:border-[rgba(120,100,255,0.26)]'
            }`}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div
        className="rounded-2xl overflow-hidden border border-[rgba(120,100,255,0.14)] mb-4 cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
      </div>

      {/* Info bar */}
      <div className="card p-4 mb-4 text-sm text-ink2 leading-relaxed">
        <strong className="text-violet2">{currentScene.emoji} {currentScene.label}</strong>
        {'  '}— {currentScene.desc}
      </div>

      {/* AI explain */}
      <div className="card p-4 flex gap-3">
        <input
          value={aiTopic}
          onChange={e => setAiTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAiExplain()}
          placeholder={`Preguntar sobre ${currentScene.label}...`}
          className="input-base flex-1"
        />
        <button onClick={handleAiExplain} disabled={aiLoading} className="btn-primary px-5 whitespace-nowrap">
          {aiLoading ? '...' : '✨ Explicar con IA'}
        </button>
      </div>

      {/* AI Result */}
      {(aiResult || aiLoading) && (
        <div className="card mt-4 overflow-hidden animate-fade-in">
          <div className="px-5 py-3 border-b border-[rgba(120,100,255,0.14)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal animate-[pulse-dot_2s_infinite]" />
            <span className="text-xs font-bold uppercase tracking-widest text-teal">Explicación didáctica</span>
          </div>
          <div className="p-5">
            {aiLoading ? (
              <div className="flex items-center gap-3 text-ink3 text-sm">
                <span className="dot-bounce">
                  <span className="w-1.5 h-1.5 bg-violet rounded-full inline-block" />
                  <span className="w-1.5 h-1.5 bg-violet rounded-full inline-block" />
                  <span className="w-1.5 h-1.5 bg-violet rounded-full inline-block" />
                </span>
                Generando explicación...
              </div>
            ) : (
              <pre className="text-sm text-ink2 whitespace-pre-wrap leading-relaxed font-body">{aiResult}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  3D SCENE BUILDERS
// ═══════════════════════════════════════════════════════════

function buildCelula(T: any, scene: any, anims: any[]) {
  // Membrana
  scene.add(new T.Mesh(
    new T.SphereGeometry(2.8, 32, 32),
    new T.MeshPhongMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.15, side: T.DoubleSide })
  ))
  // Núcleo
  const nuc = new T.Mesh(new T.SphereGeometry(0.9, 24, 24),
    new T.MeshPhongMaterial({ color: 0x6c63ff, emissive: 0x3b1f9e, emissiveIntensity: 0.3 }))
  nuc.position.set(0.2, 0.1, 0); scene.add(nuc)
  anims.push(t => { nuc.rotation.y = t * 0.3 })

  // Mitocondrias
  ;[[-1.5, 0.5, 0.8],[1.4,-0.6,0.5],[-0.8,-1.2,-0.5]].forEach((pos, i) => {
    const m = new T.Mesh(new T.SphereGeometry(0.38, 12, 8),
      new T.MeshPhongMaterial({ color: [0xff6b6b,0xf97316,0xef4444][i], emissive: 0x7c1010, emissiveIntensity: 0.2 }))
    m.position.set(...(pos as [number,number,number])); m.scale.set(1.8, 1, 1); scene.add(m)
    const off = i * 2.1
    anims.push(t => { m.position.x = pos[0] + Math.sin(t*0.5+off)*0.12; m.position.y = pos[1] + Math.cos(t*0.4+off)*0.08 })
  })
  // RE
  ;[0,1.2,2.4].forEach((angle, i) => {
    const tor = new T.Mesh(new T.TorusGeometry(0.55+i*0.1,0.07,8,24),
      new T.MeshPhongMaterial({ color: 0x34d399, transparent: true, opacity: 0.7 }))
    tor.position.set(-1.2,0.5-i*0.3,-0.8); tor.rotation.set(0.5,angle,0.3); scene.add(tor)
    anims.push(t => { tor.rotation.z = t*0.2+angle })
  })
  // Ribosomas
  const geo = new T.BufferGeometry()
  const v = []; for (let i=0;i<80;i++) { const th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1),r=1.2+Math.random()*1.4; v.push(r*Math.sin(ph)*Math.cos(th),r*Math.sin(ph)*Math.sin(th),r*Math.cos(ph)) }
  geo.setAttribute('position', new T.Float32BufferAttribute(v, 3))
  const pts = new T.Points(geo, new T.PointsMaterial({ color: 0xfbbf24, size: 0.07 })); scene.add(pts)
  anims.push(t => { pts.rotation.y = t * 0.07 })
}

function buildAtomo(T: any, scene: any, anims: any[]) {
  const nuc = new T.Mesh(new T.SphereGeometry(0.55,24,24),
    new T.MeshPhongMaterial({ color: 0xef4444, emissive: 0x7f1d1d, emissiveIntensity: 0.4 }))
  scene.add(nuc); anims.push(t => { nuc.rotation.y = t*0.6 })

  ;[[0.22,0,0],[-0.22,0,0],[0,0.22,0],[0,-0.22,0],[0,0,0.22]].forEach((p,i) => {
    const b = new T.Mesh(new T.SphereGeometry(0.14,10,10),
      new T.MeshPhongMaterial({ color: i%2===0?0xff6b6b:0x94a3b8 }))
    b.position.set(...(p as [number,number,number])); nuc.add(b)
  })

  ;[{r:1.6,color:0x6c63ff,speed:1.2,ry:0},{r:2.4,color:0x43e97b,speed:0.8,ry:Math.PI/3},{r:3.2,color:0xf7b731,speed:0.5,ry:Math.PI/2}].forEach(o => {
    const ring = new T.Mesh(new T.TorusGeometry(o.r,0.025,8,64),
      new T.MeshBasicMaterial({ color: o.color, transparent:true, opacity:0.35 }))
    ring.rotation.x = o.ry; scene.add(ring)
    const el = new T.Mesh(new T.SphereGeometry(0.14,10,10),
      new T.MeshPhongMaterial({ color: o.color, emissive: o.color, emissiveIntensity:0.5 }))
    scene.add(el)
    anims.push(t => { const a=t*o.speed; el.position.x=Math.cos(a)*o.r; el.position.y=Math.sin(a)*o.r*Math.cos(o.ry); el.position.z=Math.sin(a)*o.r*Math.sin(o.ry) })
  })
}

function buildSolar(T: any, scene: any, anims: any[]) {
  const sun = new T.Mesh(new T.SphereGeometry(1.2,24,24),
    new T.MeshPhongMaterial({ color:0xfde68a,emissive:0xf59e0b,emissiveIntensity:0.8 }))
  scene.add(sun); anims.push(t => { sun.rotation.y=t*0.3 })

  ;[{r:2.2,s:.18,c:0x94a3b8,sp:2},{r:3.2,s:.28,c:0xfcd34d,sp:1.4},{r:4.4,s:.30,c:0x38bdf8,sp:1},{r:5.8,s:.22,c:0xef4444,sp:.75},{r:7.2,s:.65,c:0xfbbf24,sp:.45}].forEach(p => {
    const ring = new T.Mesh(new T.TorusGeometry(p.r,0.015,8,64),
      new T.MeshBasicMaterial({ color:0xffffff,transparent:true,opacity:0.12 }))
    ring.rotation.x=Math.PI/2; scene.add(ring)
    const mesh = new T.Mesh(new T.SphereGeometry(p.s,16,16),
      new T.MeshPhongMaterial({ color:p.c })); scene.add(mesh)
    anims.push(t => { const a=t*p.sp*0.3; mesh.position.x=Math.cos(a)*p.r; mesh.position.z=Math.sin(a)*p.r; mesh.rotation.y=t*0.6 })
  })
}

function buildADN(T: any, scene: any, anims: any[]) {
  const TURNS=4,STEPS=80,RADIUS=1.2,PITCH=0.45
  for (let i=0;i<STEPS;i++) {
    const t1=(i/STEPS)*TURNS*Math.PI*2, t2=t1+Math.PI, y=(i/STEPS)*TURNS*PITCH*2-TURNS*PITCH
    ;[[t1,0x6c63ff],[t2,0xff6b6b]].forEach(([angle,col]) => {
      const b = new T.Mesh(new T.SphereGeometry(0.08,8,8),
        new T.MeshPhongMaterial({ color:col as number }))
      b.position.set(Math.cos(angle as number)*RADIUS,y,Math.sin(angle as number)*RADIUS); scene.add(b)
    })
    if (i%4===0) {
      const x1=Math.cos(t1)*RADIUS,z1=Math.sin(t1)*RADIUS,x2=Math.cos(t2)*RADIUS,z2=Math.sin(t2)*RADIUS
      const cyl = new T.Mesh(new T.CylinderGeometry(0.04,0.04,RADIUS*2,6),
        new T.MeshPhongMaterial({ color:0x43e97b,transparent:true,opacity:0.7 }))
      cyl.position.set((x1+x2)/2,y,(z1+z2)/2); cyl.lookAt(x1,y,z1); cyl.rotateX(Math.PI/2); scene.add(cyl)
    }
  }
  anims.push(t => { scene.rotation.y = t * 0.25 })
}

function buildGeometria(T: any, scene: any, anims: any[]) {
  ;[
    { geo: new T.BoxGeometry(1.3,1.3,1.3),    pos:[-2.5,0,0], color:0x6c63ff },
    { geo: new T.TetrahedronGeometry(1.1),      pos:[0,0,0],    color:0xff6b6b },
    { geo: new T.OctahedronGeometry(1.0),       pos:[2.5,0,0],  color:0x43e97b },
  ].forEach((s,i) => {
    const mesh = new T.Mesh(s.geo, new T.MeshPhongMaterial({ color:s.color }))
    const wire = new T.Mesh(s.geo, new T.MeshBasicMaterial({ color:0xffffff,wireframe:true,transparent:true,opacity:0.2 }))
    mesh.position.set(...(s.pos as [number,number,number])); wire.position.set(...(s.pos as [number,number,number]))
    scene.add(mesh,wire)
    const off=i*1.2
    anims.push(t => { mesh.rotation.x=t*.4+off; mesh.rotation.y=t*.6+off; wire.rotation.x=mesh.rotation.x; wire.rotation.y=mesh.rotation.y })
  })
}

function buildVolcan(T: any, scene: any, anims: any[]) {
  // Base del volcán (cono)
  const cone = new T.Mesh(new T.ConeGeometry(3,4,24),
    new T.MeshPhongMaterial({ color:0x5d4037 }))
  cone.position.y = -1; scene.add(cone)

  // Cráter
  const crater = new T.Mesh(new T.CylinderGeometry(0.6,0.9,0.5,24),
    new T.MeshPhongMaterial({ color:0x4e342e }))
  crater.position.y = 1.2; scene.add(crater)

  // Magma (esfera naranja en la base)
  const magma = new T.Mesh(new T.SphereGeometry(1.2,24,24),
    new T.MeshPhongMaterial({ color:0xff6f00,emissive:0xf4511e,emissiveIntensity:0.6 }))
  magma.position.y = -3.5; scene.add(magma)
  anims.push(t => { magma.material.emissiveIntensity = 0.4+Math.sin(t*2)*0.3 })

  // Partículas de lava
  const lavaGeo = new T.BufferGeometry()
  const lv = []; for(let i=0;i<40;i++) { lv.push((Math.random()-.5)*1.2,(Math.random()*2),(Math.random()-.5)*1.2) }
  lavaGeo.setAttribute('position', new T.Float32BufferAttribute(lv,3))
  const lavaParticles = new T.Points(lavaGeo, new T.PointsMaterial({ color:0xff3d00,size:0.12 }))
  lavaParticles.position.y = 1; scene.add(lavaParticles)
  anims.push(t => {
    const pos = lavaParticles.geometry.attributes.position.array as Float32Array
    for(let i=1;i<pos.length;i+=3) { pos[i] += 0.02; if(pos[i]>2.5) pos[i]=0 }
    lavaParticles.geometry.attributes.position.needsUpdate = true
  })

  // Nubes de humo
  ;[[0,2.5,0],[0.3,3,0.2],[-0.2,3.2,-0.1]].forEach(p => {
    const cloud = new T.Mesh(new T.SphereGeometry(0.35,12,12),
      new T.MeshPhongMaterial({ color:0x9e9e9e,transparent:true,opacity:0.5 }))
    cloud.position.set(...(p as [number,number,number])); scene.add(cloud)
    anims.push(t => { cloud.position.y = p[1] + Math.sin(t*0.8+p[0])*0.1; cloud.material.opacity = 0.3+Math.sin(t)*0.2 })
  })
}
