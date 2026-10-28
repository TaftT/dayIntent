import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell.jsx'
import { HomePage } from './components/home/HomePage.jsx'
import { DayView } from './components/dayview/DayView.jsx'
import { BacklogPage } from './components/backlog/BacklogPage.jsx'
import { JournalViewPage } from './components/journal/JournalViewPage.jsx'
import { StatsPage } from './components/stats/StatsPage.jsx'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/day/:date" element={<DayView />} />
        <Route path="/backlog" element={<BacklogPage />} />
        <Route path="/journal" element={<JournalViewPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Routes>
    </AppShell>
  )
}
