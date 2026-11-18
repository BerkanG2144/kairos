import { Header } from './app/Header.tsx'
import { useRoute } from './app/route.ts'
import { SaveError } from './app/SaveError.tsx'
import { OrgPage } from './features/organisation/OrgPage.tsx'
import { StatsPage } from './features/stats/StatsPage.tsx'
import { TrackerPage } from './features/tracker/TrackerPage.tsx'

export function App({ volatile }: { volatile: boolean }) {
  const route = useRoute()
  return (
    <>
      <Header route={route} />
      {route === 'tracker' && <TrackerPage />}
      {route === 'statistik' && <StatsPage />}
      {route === 'organisation' && <OrgPage />}
      <SaveError volatile={volatile} />
    </>
  )
}
