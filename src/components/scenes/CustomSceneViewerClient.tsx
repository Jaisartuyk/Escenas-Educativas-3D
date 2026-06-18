'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

export function CustomSceneViewerClient({ id }: { id: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pointsContainerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<{ escena: any, puntos: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeInfo, setActiveInfo] = useState<any>(null)

  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const rotRef = useRef({ y: 0, x: 0 })
  const frameRef = useRef(0)

  const supabase = createClient()

  useEffect(() => {
    async function fetchScene() {
      const { data: escena, error } = await (supabase as any).from('escenas_custom').select('*').eq('id', id).single()
      if (error || !escena) {
        toast.error('Error cargando escena')
        return setLoading(false)
      }
      
      const { data: puntos } = await (supabase as any).from('escena_puntos').select('*').eq('escena_id', id)
      
      const { data: fileData, error: dlErr } = await supabase.storage.from('modelos_3d').download(escena.storage_path)
      if (dlErr) {
        toast.error('No se pudo descargar el modelo')
        return setLoading(false)
      }

      const url = URL.createObjectURL(fileData)
      setData({ escena: { ...escena, url }, puntos: puntos || [] })
      setLoading(false)
    }
    fetchScene()
  }, [id])

  useEffect(() => {
    if (!data || !canvasRef.current || !pointsContainerRef.current) return

    let THREE: any, GLTFLoader: any
    let scene: any, camera: any, renderer: any, model: any

    const pointElements = Array.from(pointsContainerRef.current.children) as HTMLElement[]

    async function init() {
      THREE = ((await import('three')) as any).default ?? await import('three')
      const mod = await import('three/examples/jsm/loaders/GLTFLoader.js')
      GLTFLoader = mod.GLTFLoader

      const canvas = canvasRef.current!
      const W = canvas.parentElement!.clientWidth
      const H = 600

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x06050f, 1)

      scene = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 1000)
      camera.position.set(0, 2, 8)

      scene.add(new THREE.AmbientLight(0xffffff, 0.8))
      const dl = new THREE.DirectionalLight(0xffffff, 1)
      dl.position.set(5, 8, 6)
      scene.add(dl)

      const loader = new GLTFLoader()
      loader.load(data!.escena.url, (gltf: any) => {
        model = gltf.scene
        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const scale = 5 / Math.max(size.x, size.y, size.z)
        model.scale.setScalar(scale)
        model.position.sub(center.multiplyScalar(scale))
        scene.add(model)
      })

      const tempV = new THREE.Vector3()

      function animate() {
        frameRef.current = requestAnimationFrame(animate)
        
        if (!isDragging.current && !activeInfo) {
          rotRef.current.y += 0.002
        }

        const r = 8
        camera.position.x = r * Math.sin(rotRef.current.y)
        camera.position.z = r * Math.cos(rotRef.current.y)
        camera.position.y = 2 + rotRef.current.x * 5
        camera.lookAt(0, 0, 0)

        renderer.render(scene, camera)

        if (model) {
          data!.puntos.forEach((p, i) => {
            const el = pointElements[i]
            if (!el) return
            
            tempV.set(p.x, p.y, p.z)
            tempV.project(camera)

            const x = (tempV.x * .5 + .5) * W
            const y = (tempV.y * -.5 + .5) * H

            // Ocultar si está detrás de la cámara
            if (tempV.z > 1 || tempV.z < -1) {
              el.style.display = 'none'
            } else {
              el.style.display = 'flex'
              el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`
              el.style.zIndex = Math.round((1 - tempV.z) * 100).toString()
            }
          })
        }
      }
      animate()
    }
    init()

    return () => cancelAnimationFrame(frameRef.current)
  }, [data, activeInfo])

  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    rotRef.current.y += dx * 0.005
    rotRef.current.x = Math.max(-0.8, Math.min(0.8, rotRef.current.x + dy * 0.005))
    dragStart.current = { x: e.clientX, y: e.clientY }
  }
  function onMouseUp() { isDragging.current = false }

  if (loading) return <div className="p-10 text-center animate-pulse">Cargando modelo interactivo 3D...</div>
  if (!data) return null

  return (
    <div className="animate-fade-in relative max-w-5xl mx-auto">
      <Link href="/dashboard/escenas" className="text-violet2 text-sm font-bold mb-4 inline-block hover:underline">
        ← Volver a Escenas
      </Link>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{data.escena.titulo}</h1>
        <p className="text-sm text-ink3 uppercase tracking-widest">{data.escena.asignatura}</p>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-[rgba(120,100,255,0.14)] bg-bg" ref={containerRef}>
        
        <div 
          className="cursor-grab active:cursor-grabbing w-full h-[600px]"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        >
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>

        <div ref={pointsContainerRef} className="absolute inset-0 pointer-events-none overflow-hidden">
          {data.puntos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActiveInfo(p)}
              className="absolute top-0 left-0 w-8 h-8 rounded-full bg-violet2/90 border-2 border-white text-white shadow-[0_0_15px_rgba(124,109,250,0.8)] flex items-center justify-center pointer-events-auto hover:bg-violet transition-transform hover:scale-110"
              style={{ display: 'none' }}
              title={p.titulo}
            >
              <span className="text-xs font-bold">{i + 1}</span>
            </button>
          ))}
        </div>

        {activeInfo && (
          <div className="absolute top-4 right-4 w-72 bg-bg/95 backdrop-blur-md border border-[rgba(124,109,250,0.4)] rounded-xl p-5 shadow-2xl animate-fade-in pointer-events-auto">
            <button onClick={() => setActiveInfo(null)} className="absolute top-2 right-2 text-ink3 hover:text-ink text-lg font-bold p-1">×</button>
            <h3 className="font-bold text-lg text-violet2 mb-2 pr-4">{activeInfo.titulo}</h3>
            <p className="text-sm text-ink2 leading-relaxed whitespace-pre-wrap">{activeInfo.descripcion}</p>
          </div>
        )}
      </div>

      <div className="mt-4 card p-4 flex gap-4 overflow-x-auto">
        {data.puntos.map((p, i) => (
          <button key={p.id} onClick={() => setActiveInfo(p)} className="flex-shrink-0 flex items-center gap-2 bg-[rgba(0,0,0,0.03)] hover:bg-[rgba(124,109,250,0.1)] px-3 py-2 rounded-lg border border-[rgba(120,100,255,0.1)] transition-colors">
            <span className="w-5 h-5 rounded-full bg-violet2 text-white text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
            <span className="text-sm font-medium whitespace-nowrap">{p.titulo}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
