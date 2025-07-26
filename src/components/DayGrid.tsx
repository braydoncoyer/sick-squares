'use client';

import React from 'react';
import { useSession } from 'next-auth/react';

interface DaySquareProps {
  date: Date;
  intensity: number; // 0-4 intensity levels like GitHub
  onIntensityChange?: (date: string, newIntensity: number) => void;
  isClickable?: boolean;
}

const DaySquare: React.FC<DaySquareProps> = ({ date, intensity, onIntensityChange, isClickable = false }) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getIntensityClass = (intensity: number) => {
    switch (intensity) {
      case 0:
        return 'bg-gray-100 border-gray-200';
      case 1:
        return 'bg-green-100 border-green-200';
      case 2:
        return 'bg-green-200 border-green-300';
      case 3:
        return 'bg-green-400 border-green-500';
      case 4:
        return 'bg-green-600 border-green-700';
      default:
        return 'bg-gray-100 border-gray-200';
    }
  };

  const handleClick = () => {
    if (isClickable && onIntensityChange) {
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      const newIntensity = (intensity + 1) % 5; // Cycle 0->1->2->3->4->0
      onIntensityChange(dateString, newIntensity);
    }
  };

  return (
    <div className="relative group">
      <div
        className={`w-3 h-3 border rounded-sm ${getIntensityClass(
          intensity
        )} hover:border-gray-400 transition-colors ${
          isClickable ? 'cursor-pointer' : 'cursor-default'
        }`}
        onClick={handleClick}
      />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {formatDate(date)}
        {isClickable && (
          <div className="text-xs opacity-75">Click to change intensity</div>
        )}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

interface DayGridProps {
  year?: number;
}

const DayGrid: React.FC<DayGridProps> = ({ year = new Date().getFullYear() }) => {
  const { data: session } = useSession();
  const [gridData, setGridData] = React.useState<{ date: Date; intensity: number }[]>([]);
  const [loading, setLoading] = React.useState(true);

  const generateYearDates = (year: number) => {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const dates = [];

    // Start from the Sunday before the first day of the year
    const firstSunday = new Date(startDate);
    firstSunday.setDate(startDate.getDate() - startDate.getDay());

    // Generate all days until we cover the entire year
    const currentDate = new Date(firstSunday);
    while (currentDate <= endDate || currentDate.getDay() !== 0 || dates.length < 53 * 7) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
      
      // Break if we have enough weeks and we're past the year
      if (dates.length >= 53 * 7 && currentDate.getFullYear() > year) {
        break;
      }
    }

    return dates;
  };

  const loadGridData = React.useCallback(async () => {
    if (!session?.user?.email) {
      // If not logged in, show demo data
      const dates = generateYearDates(year);
      const demoData = dates.map(date => ({
        date,
        intensity: Math.floor(Math.random() * 5), // Random intensity for demo
      }));
      setGridData(demoData);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/grid?year=${year}`);
      if (response.ok) {
        const { gridData: userGridData } = await response.json();
        
        // Create a map of user data
        const userDataMap = new Map(
          userGridData.map((item: any) => [
            item.date,
            parseInt(item.intensity)
          ])
        );

        // Generate all dates for the year and merge with user data
        const dates = generateYearDates(year);
        const mergedData = dates.map(date => ({
          date,
          intensity: userDataMap.get(date.toISOString().split('T')[0]) || 0,
        }));

        setGridData(mergedData);
      }
    } catch (error) {
      console.error('Error loading grid data:', error);
    }
    setLoading(false);
  }, [session?.user?.email, year]);

  React.useEffect(() => {
    loadGridData();
  }, [loadGridData]);

  const handleIntensityChange = async (dateString: string, newIntensity: number) => {
    if (!session?.user?.email) return;

    try {
      const response = await fetch('/api/grid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: dateString,
          intensity: newIntensity,
        }),
      });

      if (response.ok) {
        // Update local state
        setGridData(prev => 
          prev.map(item => 
            item.date.toISOString().split('T')[0] === dateString
              ? { ...item, intensity: newIntensity }
              : item
          )
        );
      }
    } catch (error) {
      console.error('Error updating grid square:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const days = gridData;
  const weeks = [];

  // Group days into weeks
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const monthLabels = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="p-4">
      <div className="flex flex-col gap-2">
        {/* Month labels */}
        <div className="flex gap-1 ml-8">
          {monthLabels.map((month, index) => (
            <div
              key={month}
              className="text-xs text-gray-600 flex-1 text-left"
              style={{ minWidth: `${100 / 12}%` }}
            >
              {month}
            </div>
          ))}
        </div>

        <div className="flex gap-1">
          {/* Day of week labels */}
          <div className="flex flex-col gap-1 mr-2">
            {dayLabels.map((day, index) => (
              <div
                key={day}
                className="text-xs text-gray-600 h-3 flex items-center"
              >
                {index % 2 === 1 ? day : ''}
              </div>
            ))}
          </div>

          {/* Grid of days */}
          <div className="flex gap-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {week.map((day, dayIndex) => (
                  <DaySquare
                    key={`${weekIndex}-${dayIndex}`}
                    date={day.date}
                    intensity={day.intensity}
                    onIntensityChange={handleIntensityChange}
                    isClickable={!!session?.user?.email}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayGrid;