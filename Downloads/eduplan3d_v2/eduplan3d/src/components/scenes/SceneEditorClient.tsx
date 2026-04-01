'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export function SceneEditorClient() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<1 | 2>(1)
  const [file, setFile] = useState<File | null>(null)
  const [titulo, setTitulo] = useState('')
  const [asignatura, setAsignatura] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<any>(null)
  const sceneRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  const modelRef = useRef<any>(null)
  const frameRef = useRef<number>(0)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const rotRef = useRef({ y: 0, x: 0 })

  const [points, setPoints] = useState<{ x: number, y: number, z: number, titulo: string, descripcion: string }[]>([])
  const [activePoint, setActivePoint] = useState<{ x: number, y: number, z: number } | null>(null)
  const [ptTitulo, setPtTitulo] = useState('')
  const [ptDesc, setPtDesc] = useState('')

  const [saving, setSaving] = useState(false)

  // -- STEP 2: Inicializar Three.js cuando pasamos al paso 2 --
  useEffect(() => {
    if (step !== 2 || !canvasRef.current || !file) return

    let THREE: any, GLTFLoader: any
    let scene: any, camera: any, renderer: any

    async function init() {
      THREE = (await import('three')).default ?? await import('three')
      const mod = await import('three/examples/jsm/loaders/GLTFLoader.js')
      GLTFLoader = mod.GLTFLoader

      const canvas = canvasRef.current!
      const W = canvas.parentElement!.clientWidth
      const H = 500

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x06050f, 1)
      rendererRef.current = renderer

      scene = new THREE.Scene()
      sceneRef.current = scene

      camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 1000)
      camera.position.set(0, 2, 8)
      cameraRef.current = camera

      // Luces
      scene.add(new THREE.AmbientLight(0xffffff, 0.8))
      const dl = new THREE.DirectionalLight(0xffffff, 1)
      dl.position.set(5, 8, 6)
      scene.add(dl)

      // Cargar modelo
      const loader = new GLTFLoader()
      const url = URL.createObjectURL(file as File)
      
      loader.load(url, (gltf: any) => {
        const model = gltf.scene
        
        // Auto-center and scale
        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 5 / maxDim
        model.scale.setScalar(scale)
        model.position.sub(center.multiplyScalar(scale))

        scene.add(model)
        modelRef.current = model
      })

      // Animación
      function animate() {
        frameRef.current = requestAnimationFrame(animate)
        
        const r = 8
        camera.position.x = r * Math.sin(rotRef.current.y)
        camera.position.z = r * Math.cos(rotRef.current.y)
        camera.position.y = 2 + rotRef.current.x * 5
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
  }, [step, file])

  // -- Eventos de Mouse (Rotar y Hacer Clic/Raycast) --
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

  function onMouseUp() {
    isDragging.current = false
  }

  async function onDoubleClick(e: React.MouseEvent) {
    if (!canvasRef.current || !modelRef.current || !cameraRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    const THREE = (await import('three')).default ?? await import('three')
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current)

    const hits = raycaster.intersectObject(modelRef.current, true)
    if (hits.length > 0) {
      const p = hits[0].point
      setActivePoint({ x: p.x, y: p.y, z: p.z })
      setPtTitulo('')
      setPtDesc('')
    }
  }

  function savePoint() {
    if (!activePoint || !ptTitulo || !ptDesc) return
    setPoints(prev => [...prev, { ...activePoint, titulo: ptTitulo, descripcion: ptDesc }])
    setActivePoint(null)
    toast.success('Punto guardado en el modelo')
  }

  async function handleFinalSave() {
    if (!file) return
    setSaving(true)
    const t = toast.loading('Guardando modelo y puntos...')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      
      const { error: uploadErr } = await supabase.storage.from('modelos_3d').upload(fileName, file)
      if (uploadErr) throw new Error('Error al subir GLB: ' + uploadErr.message)

      const { data: escena, error: dbErr } = await supabase.from('escenas_custom').insert({
        user_id: user.id,
        titulo,
        asignatura,
        storage_path: fileName
      }).select().single()

      if (dbErr || !escena) throw new Error('Error al guardar datos')

      if (points.length > 0) {
        const insertPoints = points.map(p => ({
          escena_id: escena.id,
          x: p.x, y: p.y, z: p.z,
          titulo: p.titulo,
          descripcion: p.descripcion
        }))
        const { error: ptErr } = await supabase.from('escena_puntos').insert(insertPoints)
        if (ptErr) throw new Error('Error al guardar puntos: ' + ptErr.message)
      }

      toast.success('¡Modelo Interactivo Creado!', { id: t })
      router.push('/dashboard/escenas')
    } catch (err: any) {
      toast.error(err.message, { id: t })
    } finally {
      setSaving(false)
    }
  }

  if (step === 1) {
    return (
      <div className="card p-6 max-w-xl">
        <h2 className="text-xl font-bold mb-4">Información del Modelo</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink3 mb-1 uppercase">Título del Modelo</label>
            <input value={titulo} onChange={e=>setTitulo(e.target.value)} className="input-base" placeholder="Ej. El Coliseo Romano" />
          </div>
          <div>
            <label className="block text-xs font-bold text-ink3 mb-1 uppercase">Asignatura</label>
            <input value={asignatura} onChange={e=>setAsignatura(e.target.value)} className="input-base" placeholder="Ej. Historia" />
          </div>
          <div>
            <label className="block text-xs font-bold text-ink3 mb-1 uppercase">Archivo 3D (.glb o .gltf)</label>
            <input type="file" accept=".glb,.gltf" onChange={e=>setFile(e.target.files?.[0]||null)} className="input-base p-1.5" />
          </div>
          <button 
            disabled={!file || !titulo || !asignatura} 
            onClick={() => setStep(2)} 
            className="btn-primary w-full py-2 disabled:opacity-50"
          >
            Siguiente: Editar en 3D
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-5">
      <div className="flex-1 relative">
        <div className="absolute top-4 left-4 z-10 bg-[rgba(0,0,0,0.5)] px-3 py-1.5 rounded-lg backdrop-blur-sm text-xs text-white">
          🖱️ Arrastra para rotar | 💥 <strong>Doble clic</strong> para añadir un punto
        </div>
        
        <div 
          className="rounded-2xl overflow-hidden border border-[rgba(120,100,255,0.14)] cursor-grab active:cursor-grabbing bg-[#06050f]"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onDoubleClick={onDoubleClick}
        >
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
        </div>

        {points.length > 0 && (
          <div className="mt-4 p-4 card text-sm">
            <h4 className="font-bold mb-2">Puntos agregados ({points.length}):</h4>
            <ul className="list-disc pl-5 space-y-1 text-ink2">
              {points.map((p, i) => (
                <li key={i}><strong>{p.titulo}</strong> <span className="text-ink3 text-xs opacity-50">(x:{p.x.toFixed(1)}, y:{p.y.toFixed(1)}, z:{p.z.toFixed(1)})</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="w-full md:w-80 flex flex-col gap-4">
        {activePoint ? (
          <div className="card p-5 animate-fade-in border-[rgba(124,109,250,0.5)]">
            <h3 className="font-bold mb-3 text-violet2">Añadir Punto de Información</h3>
            <div className="space-y-3">
              <input value={ptTitulo} onChange={e=>setPtTitulo(e.target.value)} placeholder="Título del punto" className="input-base text-sm" />
              <textarea value={ptDesc} onChange={e=>setPtDesc(e.target.value)} placeholder="Explicación o concepto" className="input-base text-sm h-24 resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setActivePoint(null)} className="btn-secondary flex-1 py-1.5 text-xs">Cancelar</button>
                <button onClick={savePoint} className="btn-primary flex-1 py-1.5 text-xs">Guardar Punto</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-5 border-dashed border-2 border-[rgba(120,100,255,0.14)] text-center">
            <p className="text-sm text-ink3 mb-2">Haz doble clic en cualquier parte de la figura para etiquetarla.</p>
          </div>
        )}

        <div className="card p-5 bg-[rgba(124,109,250,0.05)]">
          <h3 className="font-bold mb-1">Finalizar</h3>
          <p className="text-xs text-ink3 mb-4">Se guardará en la nube y tus estudiantes podrán interactuar con el modelo y tus puntos.</p>
          <button onClick={handleFinalSave} disabled={saving} className="btn-primary w-full py-2">
            {saving ? 'Guardando en la nube...' : 'Confirmar y Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
