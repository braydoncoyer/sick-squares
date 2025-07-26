import { sql } from '@vercel/postgres'

export interface UserGrid {
  id: string
  user_id: string
  date: string // YYYY-MM-DD format
  intensity: number // 0-4
  created_at: Date
  updated_at: Date
}

export interface UserStats {
  totalSickDays: number
  percentageOfYear: number
  mostCommonDay: string
  currentStreak: number
  longestStreak: number
  averageIntensity: number
}

export async function initializeDatabase() {
  try {
    // Create users table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT,
        image TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Create user_grids table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS user_grids (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        date DATE NOT NULL,
        intensity INTEGER NOT NULL DEFAULT 0 CHECK (intensity >= 0 AND intensity <= 4),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `

    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}

export async function getUserGridData(userId: string, year: number): Promise<UserGrid[]> {
  try {
    const result = await sql`
      SELECT * FROM user_grids 
      WHERE user_id = ${userId} 
      AND EXTRACT(YEAR FROM date) = ${year}
      ORDER BY date
    `
    return result.rows as UserGrid[]
  } catch (error) {
    console.error('Error fetching user grid data:', error)
    throw error
  }
}

export async function updateGridSquare(userId: string, date: string, intensity: number): Promise<UserGrid> {
  try {
    const result = await sql`
      INSERT INTO user_grids (user_id, date, intensity, updated_at)
      VALUES (${userId}, ${date}, ${intensity}, NOW())
      ON CONFLICT (user_id, date)
      DO UPDATE SET 
        intensity = ${intensity},
        updated_at = NOW()
      RETURNING *
    `
    return result.rows[0] as UserGrid
  } catch (error) {
    console.error('Error updating grid square:', error)
    throw error
  }
}

export async function getUserStats(userId: string, year: number): Promise<UserStats> {
  try {
    // Get all data for the year
    const yearData = await sql`
      SELECT 
        date,
        intensity,
        EXTRACT(DOW FROM date) as day_of_week
      FROM user_grids 
      WHERE user_id = ${userId} 
      AND EXTRACT(YEAR FROM date) = ${year}
      AND intensity > 0
      ORDER BY date
    `

    const sickDays = yearData.rows
    const totalSickDays = sickDays.length
    
    // Calculate percentage of year (365 or 366 days)
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
    const daysInYear = isLeapYear ? 366 : 365
    const percentageOfYear = (totalSickDays / daysInYear) * 100

    // Find most common day of week
    const dayCount: { [key: number]: number } = {}
    sickDays.forEach(day => {
      const dow = parseInt(day.day_of_week)
      dayCount[dow] = (dayCount[dow] || 0) + 1
    })

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    let mostCommonDay = 'None'
    let maxCount = 0
    Object.entries(dayCount).forEach(([dow, count]) => {
      if (count > maxCount) {
        maxCount = count
        mostCommonDay = dayNames[parseInt(dow)]
      }
    })

    // Calculate streaks
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    
    const sortedDates = sickDays.map(d => new Date(d.date)).sort((a, b) => a.getTime() - b.getTime())
    const today = new Date()
    
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1
      } else {
        const prevDate = sortedDates[i - 1]
        const currDate = sortedDates[i]
        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
        
        if (diffDays === 1) {
          tempStreak++
        } else {
          longestStreak = Math.max(longestStreak, tempStreak)
          tempStreak = 1
        }
      }
      
      // Check if this is part of current streak (ending today or yesterday)
      const diffFromToday = Math.floor((today.getTime() - sortedDates[i].getTime()) / (1000 * 60 * 60 * 24))
      if (diffFromToday <= 1 && i === sortedDates.length - 1) {
        currentStreak = tempStreak
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak)

    // Calculate average intensity
    const totalIntensity = sickDays.reduce((sum, day) => sum + parseInt(day.intensity), 0)
    const averageIntensity = totalSickDays > 0 ? totalIntensity / totalSickDays : 0

    return {
      totalSickDays,
      percentageOfYear: Math.round(percentageOfYear * 100) / 100,
      mostCommonDay,
      currentStreak,
      longestStreak,
      averageIntensity: Math.round(averageIntensity * 100) / 100
    }
  } catch (error) {
    console.error('Error calculating user stats:', error)
    throw error
  }
}

export async function ensureUser(user: { id: string; email?: string; name?: string; image?: string }) {
  try {
    await sql`
      INSERT INTO users (id, email, name, image)
      VALUES (${user.id}, ${user.email || null}, ${user.name || null}, ${user.image || null})
      ON CONFLICT (id) 
      DO UPDATE SET 
        email = COALESCE(${user.email}, users.email),
        name = COALESCE(${user.name}, users.name),
        image = COALESCE(${user.image}, users.image),
        updated_at = NOW()
    `
  } catch (error) {
    console.error('Error ensuring user exists:', error)
    throw error
  }
}