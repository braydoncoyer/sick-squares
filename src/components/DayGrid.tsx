'use client';

import React from 'react';
import { useSession } from 'next-auth/react';

interface DaySquareProps {
  date: Date;
  intensity: number; // 0-4 intensity levels like GitHub
  onIntensityChange?: (date: string, newIntensity: number) => void;
  isClickable?: boolean;
  isOutsideYear?: boolean;
  isLoading?: boolean;
}

const DaySquare: React.FC<DaySquareProps> = ({ date, intensity, onIntensityChange, isClickable = false, isOutsideYear = false, isLoading = false }) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isFutureDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0); // Set to start of the date to check
    return checkDate > today;
  };

  const isFuture = isFutureDate();

  const getIntensityClass = (intensity: number) => {
    if (isLoading) {
      // Show disabled state while loading
      return 'bg-gray-50 border-gray-150 opacity-50 animate-pulse';
    }
    
    if (isFuture) {
      // Gray out future dates
      return 'bg-gray-50 border-gray-150 opacity-30';
    }
    
    if (isOutsideYear) {
      // Gray out dates outside the target year
      return 'bg-gray-50 border-gray-150 opacity-40';
    }
    
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
    if (isClickable && onIntensityChange && !isOutsideYear && !isLoading && !isFuture) {
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
        )} transition-colors ${
          isClickable && !isOutsideYear && !isLoading && !isFuture
            ? 'cursor-pointer hover:border-gray-400' 
            : 'cursor-default'
        }`}
        onClick={handleClick}
      />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {formatDate(date)}
        {isLoading && (
          <div className="text-xs opacity-75">Loading...</div>
        )}
        {isFuture && (
          <div className="text-xs opacity-75">Future date - cannot modify</div>
        )}
        {!isLoading && !isFuture && isClickable && !isOutsideYear && (
          <div className="text-xs opacity-75">Click to change intensity</div>
        )}
        {isOutsideYear && (
          <div className="text-xs opacity-75">Outside target year</div>
        )}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

const DayGrid: React.FC = () => {
  const { data: session, status } = useSession();
  const [gridData, setGridData] = React.useState<{ date: Date; intensity: number }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [demoTimeout, setDemoTimeout] = React.useState<NodeJS.Timeout | null>(null);

  const generateRolling12Months = () => {
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    oneYearAgo.setDate(today.getDate() + 1); // Start from day after one year ago

    const dates = [];

    // Start from the Sunday before or on the start date
    const startDate = new Date(oneYearAgo);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Generate dates until we have complete weeks past today
    const currentDate = new Date(startDate);
    while (currentDate <= today || currentDate.getDay() !== 0) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Ensure we have complete weeks (multiples of 7)
    while (dates.length % 7 !== 0) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  };

  const loadGridData = React.useCallback(async () => {
    // Clear any existing demo timeout
    if (demoTimeout) {
      clearTimeout(demoTimeout);
      setDemoTimeout(null);
    }

    // Wait for session to finish loading
    if (status === 'loading') {
      return;
    }

    const dates = generateRolling12Months();
    
    // Always start with empty grid
    const emptyData = dates.map(date => ({
      date,
      intensity: 0, // Start with empty squares
    }));
    setGridData(emptyData);

    if (status === 'unauthenticated' || !session?.user?.email) {
      // If not logged in, show demo data after a brief moment
      const timeout = setTimeout(() => {
        const demoData = dates.map(date => ({
          date,
          intensity: Math.floor(Math.random() * 5), // Random intensity for demo
        }));
        setGridData(demoData);
        setLoading(false);
        setDemoTimeout(null);
      }, 500);
      setDemoTimeout(timeout);
      return;
    }

    // For logged-in users, fetch their real data
    try {
      // Get the date range for the API call
      const startDate = dates[0].toISOString().split('T')[0];
      const endDate = dates[dates.length - 1].toISOString().split('T')[0];
      
      const response = await fetch(`/api/grid?startDate=${startDate}&endDate=${endDate}`);
      if (response.ok) {
        const { gridData: userGridData } = await response.json();
        
        // Create a map of user data
        const userDataMap = new Map(
          userGridData.map((item: any) => [
            item.date.split('T')[0], // Extract just the date part (YYYY-MM-DD)
            parseInt(item.intensity)
          ])
        );

        // Merge with user data - this should show real user data, not demo data
        const mergedData = dates.map(date => {
          const dateKey = date.toISOString().split('T')[0];
          const intensity = userDataMap.get(dateKey) || 0;
          return { date, intensity };
        });

        setGridData(mergedData);
        setLoading(false);
      } else {
        // If API call fails, keep the empty grid
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading grid data:', error);
      // If API call fails, keep the empty grid
      setLoading(false);
    }
  }, [session?.user?.email, status, demoTimeout]);

  React.useEffect(() => {
    loadGridData();
  }, [loadGridData]);

  // Cleanup effect to clear timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (demoTimeout) {
        clearTimeout(demoTimeout);
      }
    };
  }, [demoTimeout]);

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

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Generate month labels based on the actual grid data  
  const generateMonthLabels = () => {
    if (weeks.length === 0) return [];
    
    const labels: { month: string; position: number }[] = [];
    let currentMonth = -1;
    
    weeks.forEach((week, weekIndex) => {
      // Check the first day of each week
      const firstDay = week[0];
      if (firstDay && firstDay.date.getMonth() !== currentMonth) {
        currentMonth = firstDay.date.getMonth();
        const monthName = firstDay.date.toLocaleDateString('en-US', { month: 'short' });
        labels.push({ month: monthName, position: weekIndex });
      }
    });
    
    return labels;
  };

  const monthLabels = generateMonthLabels();

  return (
    <div className="w-full">
      {/* Container with horizontal scroll */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-max p-4">
          <div className="flex flex-col gap-2">
            {/* Month labels positioned over actual weeks */}
            <div className="flex gap-1 ml-8 relative h-4">
              {monthLabels.map((label, index) => (
                <div
                  key={`${label.month}-${index}`}
                  className="text-xs text-gray-600 absolute whitespace-nowrap"
                  style={{ left: `${label.position * 16}px` }}
                >
                  {label.month}
                </div>
              ))}
            </div>

            <div className="flex gap-1">
              {/* Day of week labels - fixed width to prevent shifting */}
              <div className="flex flex-col gap-1 mr-2 flex-shrink-0">
                {dayLabels.map((day, index) => (
                  <div
                    key={day}
                    className="text-xs text-gray-600 h-3 flex items-center w-6 text-right"
                  >
                    {index % 2 === 1 ? day : ''}
                  </div>
                ))}
              </div>

              {/* Grid of days - scrollable content */}
              <div className="flex gap-1 min-w-max">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {week.map((day, dayIndex) => (
                      <DaySquare
                        key={`${weekIndex}-${dayIndex}`}
                        date={day.date}
                        intensity={day.intensity}
                        onIntensityChange={handleIntensityChange}
                        isClickable={!!session?.user?.email}
                        isOutsideYear={false}
                        isLoading={loading}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayGrid;