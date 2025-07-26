'use client';

import React from 'react';
import { useSession } from 'next-auth/react';

interface StatsData {
  // Overall Stats
  totalSickDays: number;
  percentageOfYear: number;
  yearToDatePercentage: number;
  averageIntensity: number;
  
  // Pattern Stats
  mostCommonDay: string;
  recoveryRate: number;
  
  // Streak Stats
  currentStreak: number;
  longestStreak: number;
  averageSickStreak: number;
}

const UserStats: React.FC = () => {
  const { data: session } = useSession();
  const [stats, setStats] = React.useState<StatsData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const generateRolling12Months = () => {
    // Use consistent timezone handling - always work in local timezone
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    // Calculate exactly 365 days ago (not 1 year ago to avoid leap year issues)
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 365);
    
    // Find the Sunday before or on the start date
    const firstSunday = new Date(startDate);
    firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());
    
    const dates = [];
    const currentDate = new Date(firstSunday);
    
    // Generate dates for complete weeks that include today
    while (currentDate <= today) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Add remaining days to complete the final week
    while (dates.length % 7 !== 0) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  };

  React.useEffect(() => {
    const loadStats = async () => {
      if (!session?.user?.email) {
        setLoading(false);
        return;
      }

      try {
        const dates = generateRolling12Months();
        const startDate = dates[0].toISOString().split('T')[0];
        const endDate = dates[dates.length - 1].toISOString().split('T')[0];
        
        const response = await fetch(`/api/stats?startDate=${startDate}&endDate=${endDate}`);
        if (response.ok) {
          const { stats: userStats } = await response.json();
          setStats(userStats);
        }
      } catch (error) {
        console.error('Error loading user stats:', error);
      }
      setLoading(false);
    };

    loadStats();
  }, [session?.user?.email]);

  if (!session?.user?.email) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Your Health Journey Matters</h3>
        
        <div className="space-y-4 text-sm text-gray-600">
          <p>
            While tracking sick days might seem like dwelling on the negative, SickSquares helps you see the bigger picture. 
            Every square represents not just a day you felt unwell, but a day you persevered through challenges.
          </p>
          
          <p>
            When you look back at your health data over months and years, you discover patterns that help you make better 
            choices. You see your resilience visualized—how you bounced back from illness, how your recovery improved, 
            and how much strength you showed just by showing up.
          </p>
          
          <p>
            Your data becomes a testament to your endurance and a tool for understanding your health better. 
            Each visualization tells the story of someone who kept going, even on the hardest days.
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            Sign in with GitHub to start tracking your journey and unlock personalized insights.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Your Statistics (Last 12 Months)</h3>
        <div className="text-gray-500">Loading stats...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Your Statistics (Last 12 Months)</h3>
        <div className="text-gray-500">No data available</div>
      </div>
    );
  }

  const StatCard: React.FC<{ label: string; value: string | number; description?: string }> = ({ 
    label, 
    value, 
    description 
  }) => (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm font-medium text-gray-700">{label}</div>
      {description && (
        <div className="text-xs text-gray-500 mt-1">{description}</div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Your Statistics (Last 12 Months)</h3>
      
      {/* Overall Stats */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">📊 Overall Stats</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard 
            label="Total Sick Days"
            value={stats.totalSickDays}
            description="Days with any intensity > 0"
          />
          <StatCard 
            label="Last 12 Months"
            value={`${stats.percentageOfYear}%`}
            description="Percentage of rolling year"
          />
          <StatCard 
            label="Year-to-Date"
            value={`${stats.yearToDatePercentage}%`}
            description="Jan 1st to today"
          />
          <StatCard 
            label="Average Intensity"
            value={stats.averageIntensity.toFixed(1)}
            description="Mean intensity when sick"
          />
        </div>
      </div>

      {/* Pattern Stats */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">🔍 Pattern Stats</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatCard 
            label="Most Common Day"
            value={stats.mostCommonDay}
            description="Day of week you're sick most"
          />
          <StatCard 
            label="Recovery Rate"
            value={stats.recoveryRate > 0 ? `${stats.recoveryRate.toFixed(1)} days` : 'N/A'}
            description="Average days between sick periods"
          />
        </div>
      </div>

      {/* Streak Stats */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">⚡ Streak Stats</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard 
            label="Current Streak"
            value={stats.currentStreak}
            description="Consecutive sick days ending now"
          />
          <StatCard 
            label="Longest Streak"
            value={stats.longestStreak}
            description="Longest consecutive sick period"
          />
          <StatCard 
            label="Average Streak"
            value={stats.averageSickStreak > 0 ? stats.averageSickStreak.toFixed(1) : 'N/A'}
            description="Average length of sick streaks"
          />
        </div>
      </div>

      <div className="text-xs text-gray-500 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded-sm"></div>
            <span>0 - Feeling great</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-green-100 border border-green-200 rounded-sm"></div>
            <span>1 - Slightly unwell</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-green-200 border border-green-300 rounded-sm"></div>
            <span>2 - Moderately sick</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-green-400 border border-green-500 rounded-sm"></div>
            <span>3 - Quite unwell</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-green-600 border border-green-700 rounded-sm"></div>
            <span>4 - Very sick</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserStats;