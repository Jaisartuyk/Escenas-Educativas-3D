import type { Metadata } from 'next'
import { CustomSceneViewerClient } from '@/components/scenes/CustomSceneViewerClient'

export const metadata: Metadata = { title: 'Modelo 3D Interactivo' }

export default function CustomScenePage({ params }: { params: { id: string } }) {
  return <CustomSceneViewerClient id={params.id} />
}
