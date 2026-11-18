import { Header } from './app/Header.tsx'
import { useRoute } from './app/route.ts'
import { SaveError } from './app/SaveError.tsx'
import { TimerTitle } from './app/TimerTitle.tsx'
import { UpdateToast } from './app/UpdateToast.tsx'
import { useRollover } from './state/useRollover.ts'
import { HomePage } from './features/home/HomePage.tsx'
import { OrgPage } from './features/organisation/OrgPage.tsx'
import { PlanPage } from './features/plan/PlanPage.tsx'
import { StatsPage } from './features/stats/StatsPage.tsx'
import { GapToast } from './features/tracker/GapToast.tsx'
import { TrackerPage } from './features/tracker/TrackerPage.tsx'

export function App({ volatile }: { volatile: boolean }) {
  const route = useRoute()
  useRollover()
  return (
    <>
      <Header route={route} />
      {route === 'home' && <HomePage />}
      {route === 'plan' && <PlanPage />}
      {route === 'tracker' && <TrackerPage />}
      {route === 'statistik' && <StatsPage />}
      {route === 'organisation' && <OrgPage />}
      <SaveError volatile={volatile} />
      <GapToast />
      <UpdateToast />
      <TimerTitle />
    </>
  )
}
