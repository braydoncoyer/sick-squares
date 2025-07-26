'use client';

import React from 'react';
import { useSession } from 'next-auth/react';

interface StatsData {
  totalSickDays: number;
  percentageOfYear: number;
  mostCommonDay: string;
  currentStreak: number;
  longestStreak: number;
  averageIntensity: number;
}

const UserStats: React.FC = () => {
  const { data: session } = useSession();
  const [stats, setStats] = React.useState<StatsData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const generateRolling12Months = () => {
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    oneYearAgo.setDate(today.getDate() + 1);
    
    const dates = [];
    const startDate = new Date(oneYearAgo);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const currentDate = new Date(startDate);
    while (currentDate <= today || currentDate.getDay() !== 0) {
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
      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 text-center">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">Sign in to track your stats</h3>
        <p className="text-sm text-gray-600">Login with GitHub to save your data and see personalized statistics.</p>
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
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <StatCard 
          label="Total Sick Days"
          value={stats.totalSickDays}
          description="Days with any intensity > 0"
        />
        
        <StatCard 
          label="Percentage of Year"
          value={`${stats.percentageOfYear}%`}
          description="Time spent feeling unwell"
        />
        
        <StatCard 
          label="Most Common Day"
          value={stats.mostCommonDay}
          description="Day of week you're most sick"
        />
        
        <StatCard 
          label="Current Streak"
          value={stats.currentStreak}
          description="Consecutive sick days ending recently"
        />
        
        <StatCard 
          label="Longest Streak"
          value={stats.longestStreak}
          description="Most consecutive sick days"
        />
        
        <StatCard 
          label="Average Intensity"
          value={stats.averageIntensity.toFixed(1)}
          description="Mean intensity when sick (0-4 scale)"
        />
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