import PlayerClient from './PlayerClient'

export default async function WatchPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params

  return <PlayerClient params={{ type, id }} />
}
