import DayGrid from "@/components/DayGrid";
import UserStats from "@/components/UserStats";
import AuthButton from "@/components/AuthButton";
import SessionProvider from "@/components/SessionProvider";

export default function Home() {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <header className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                  SickSquares
                </h1>
                <p className="text-gray-600 text-sm sm:text-base">
                  Track your sick days like GitHub contributions
                </p>
              </div>
              <div className="self-start sm:self-auto">
                <AuthButton />
              </div>
            </div>
          </header>

          <main className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6">
              <div className="mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
                  Last 12 Months
                </h2>
                <p className="text-xs sm:text-sm text-gray-600">
                  Hover over squares to see dates. Click squares when logged in
                  to track your sick days.
                </p>
              </div>

              <DayGrid />

              <div className="mt-4 sm:mt-6 flex items-center gap-2 text-xs sm:text-sm text-gray-600 overflow-x-auto">
                <span className="whitespace-nowrap">Less sick</span>
                <div className="flex gap-1 flex-shrink-0">
                  <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded-sm"></div>
                  <div className="w-3 h-3 bg-green-100 border border-green-200 rounded-sm"></div>
                  <div className="w-3 h-3 bg-green-200 border border-green-300 rounded-sm"></div>
                  <div className="w-3 h-3 bg-green-400 border border-green-500 rounded-sm"></div>
                  <div className="w-3 h-3 bg-green-600 border border-green-700 rounded-sm"></div>
                </div>
                <span className="whitespace-nowrap">More sick</span>
              </div>
            </div>

            <UserStats />
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
