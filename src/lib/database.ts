import { Pool } from 'pg'

// Create a connection pool with production optimizations
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
})

export interface UserGrid {
  id: string
  user_id: string
  date: string // YYYY-MM-DD format
  intensity: number // 0-4
  created_at: Date
  updated_at: Date
}

interface DatabaseUserGrid {
  id: string
  user_id: string
  date: string
  intensity: string | number
  created_at: string | Date
  updated_at: string | Date
}

interface DatabaseUser {
  id: string
  email: string
  name?: string
  image?: string
  created_at: string | Date
  updated_at: string | Date
}

interface DatabaseStatsRow {
  date: string
  intensity: string | number
  day_of_week: string | number
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
  const client = await pool.connect()
  try {
    // Create users table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT,
        image TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Create user_grids table if it doesn't exist
    await client.query(`
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
    `)

    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function getUserGridData(userId: string, year: number): Promise<UserGrid[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(
      'SELECT * FROM user_grids WHERE user_id = $1 AND EXTRACT(YEAR FROM date) = $2 ORDER BY date',
      [userId, year]
    )
    return result.rows.map((row: DatabaseUserGrid): UserGrid => ({
      id: row.id,
      user_id: row.user_id,
      date: row.date,
      intensity: typeof row.intensity === 'string' ? parseInt(row.intensity) : row.intensity,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }))
  } catch (error) {
    console.error('Error fetching user grid data:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function getUserGridDataByDateRange(userId: string, startDate: string, endDate: string): Promise<UserGrid[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(
      'SELECT * FROM user_grids WHERE user_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date',
      [userId, startDate, endDate]
    )
    return result.rows.map((row: DatabaseUserGrid): UserGrid => ({
      id: row.id,
      user_id: row.user_id,
      date: row.date,
      intensity: typeof row.intensity === 'string' ? parseInt(row.intensity) : row.intensity,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }))
  } catch (error) {
    console.error('Error fetching user grid data by date range:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function updateGridSquare(userId: string, date: string, intensity: number): Promise<UserGrid> {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `INSERT INTO user_grids (user_id, date, intensity, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, date)
       DO UPDATE SET 
         intensity = $3,
         updated_at = NOW()
       RETURNING *`,
      [userId, date, intensity]
    )
    const row: DatabaseUserGrid = result.rows[0]
    return {
      id: row.id,
      user_id: row.user_id,
      date: row.date,
      intensity: typeof row.intensity === 'string' ? parseInt(row.intensity) : row.intensity,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }
  } catch (error) {
    console.error('Error updating grid square:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function getUserStats(userId: string, year: number): Promise<UserStats> {
  const client = await pool.connect()
  try {
    // Get all data for the year
    const yearData = await client.query(
      `SELECT 
        date,
        intensity,
        EXTRACT(DOW FROM date) as day_of_week
      FROM user_grids 
      WHERE user_id = $1 
      AND EXTRACT(YEAR FROM date) = $2
      AND intensity > 0
      ORDER BY date`,
      [userId, year]
    )

    const sickDays: DatabaseStatsRow[] = yearData.rows
    const totalSickDays = sickDays.length
    
    // Calculate percentage of year (365 or 366 days)
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
    const daysInYear = isLeapYear ? 366 : 365
    const percentageOfYear = (totalSickDays / daysInYear) * 100

    // Find most common day of week
    const dayCount: { [key: number]: number } = {}
    sickDays.forEach(day => {
      const dow = typeof day.day_of_week === 'string' ? parseInt(day.day_of_week) : day.day_of_week
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
    const totalIntensity = sickDays.reduce((sum, day) => {
      const intensity = typeof day.intensity === 'string' ? parseInt(day.intensity) : day.intensity
      return sum + intensity
    }, 0)
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
  } finally {
    client.release()
  }
}

export async function getUserStatsByDateRange(userId: string, startDate: string, endDate: string): Promise<UserStats> {
  const client = await pool.connect()
  try {
    // Get all data for the date range
    const dateRangeData = await client.query(
      `SELECT 
        date,
        intensity,
        EXTRACT(DOW FROM date) as day_of_week
      FROM user_grids 
      WHERE user_id = $1 
      AND date BETWEEN $2 AND $3
      AND intensity > 0
      ORDER BY date`,
      [userId, startDate, endDate]
    )

    const sickDays = dateRangeData.rows
    const totalSickDays = sickDays.length
    
    // Calculate percentage of the date range (approximately 365 days for rolling 12 months)
    const start = new Date(startDate)
    const end = new Date(endDate)
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const percentageOfYear = (totalSickDays / totalDays) * 100

    // Find most common day of week
    const dayCount: { [key: number]: number } = {}
    sickDays.forEach(day => {
      const dow = typeof day.day_of_week === 'string' ? parseInt(day.day_of_week) : day.day_of_week
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
    const totalIntensity = sickDays.reduce((sum, day) => {
      const intensity = typeof day.intensity === 'string' ? parseInt(day.intensity) : day.intensity
      return sum + intensity
    }, 0)
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
    console.error('Error calculating user stats by date range:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function ensureUser(user: { id: string; email?: string; name?: string; image?: string }) {
  const client = await pool.connect()
  try {
    await client.query(
      `INSERT INTO users (id, email, name, image)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) 
       DO UPDATE SET 
         email = COALESCE($2, users.email),
         name = COALESCE($3, users.name),
         image = COALESCE($4, users.image),
         updated_at = NOW()`,
      [user.id, user.email || null, user.name || null, user.image || null]
    )
  } catch (error) {
    console.error('Error ensuring user exists:', error)
    throw error
  } finally {
    client.release()
  }
}