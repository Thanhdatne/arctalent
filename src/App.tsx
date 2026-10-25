/**
 * ArcTalent — Web3 Talent Network
 * Built with Arc Studio — https://studio.arc.io
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Landing } from '@/pages/Landing'
import { JobBoard } from '@/pages/JobBoard'
import { JobDetail } from '@/pages/JobDetail'
import { PostJob } from '@/pages/PostJob'
import { TalentDirectory } from '@/pages/TalentDirectory'
import { TalentProfile } from '@/pages/TalentProfile'
import { Dashboard } from '@/pages/Dashboard'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-dvh flex flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/jobs" element={<JobBoard />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/post-job" element={<PostJob />} />
            <Route path="/talent" element={<TalentDirectory />} />
            <Route path="/talent/:address" element={<TalentProfile />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}
