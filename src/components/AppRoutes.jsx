import { Routes, Route } from 'react-router-dom'
import { HomePage } from './home/HomePage.jsx'
import { DayView } from './dayview/DayView.jsx'
import { BacklogPage } from './backlog/BacklogPage.jsx'
import { JournalViewPage } from './journal/JournalViewPage.jsx'
import { StatsPage } from './stats/StatsPage.jsx'

// `location` lets the split view's second pane render the same pages for its
// own path instead of the browser's.
export function AppRoutes({ location }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<HomePage />} />
      <Route path="/day/:date" element={<DayView />} />
      <Route path="/backlog" element={<BacklogPage />} />
      <Route path="/journal" element={<JournalViewPage />} />
      <Route path="/stats" element={<StatsPage />} />
    </Routes>
  )
}
