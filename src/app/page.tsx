import DayGrid from '@/components/DayGrid';
import UserStats from '@/components/UserStats';
import AuthButton from '@/components/AuthButton';
import SessionProvider from '@/components/SessionProvider';

export default function Home() {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <header className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">SickSquares</h1>
                <p className="text-gray-600">Track your sick days like GitHub contributions</p>
              </div>
              <AuthButton />
            </div>
          </header>
        
        <main className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">2024 Activity</h2>
              <p className="text-sm text-gray-600">
                Hover over squares to see dates. Click squares when logged in to track your sick days.
              </p>
            </div>
            
            <DayGrid year={2024} />
            
            <div className="mt-6 flex items-center gap-2 text-sm text-gray-600">
              <span>Less sick</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-100 border border-green-200 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-200 border border-green-300 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-400 border border-green-500 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-600 border border-green-700 rounded-sm"></div>
              </div>
              <span>More sick</span>
            </div>
          </div>

          <UserStats year={2024} />
        </main>
      </div>
    </div>
    </SessionProvider>
  );
}
