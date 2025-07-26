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
  username?: string
  is_public?: boolean
  created_at: string | Date
  updated_at: string | Date
}

interface DatabaseStatsRow {
  date: string
  intensity: string | number
  day_of_week: string | number
}

export interface UserStats {
  // Overall Stats
  totalSickDays: number
  percentageOfYear: number // Rolling 12 months
  yearToDatePercentage: number // Jan 1 to today
  averageIntensity: number
  
  // Pattern Stats
  mostCommonDay: string
  recoveryRate: number // Average days between sick periods
  
  // Streak Stats
  currentStreak: number
  longestStreak: number
  averageSickStreak: number
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
        username TEXT UNIQUE,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Add new columns to existing users table if they don't exist
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE
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

    // Calculate year-to-date percentage (Jan 1 to today)
    const currentYear = new Date().getFullYear()
    const yearStart = new Date(currentYear, 0, 1)
    const currentDateForYTD = new Date()
    const daysIntoYear = Math.floor((currentDateForYTD.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    
    // For year-to-date, we need current year data only
    const yearToDateSickDays = year === currentYear ? totalSickDays : sickDays.filter(day => {
      const dayDate = new Date(day.date)
      return dayDate.getFullYear() === currentYear
    }).length
    const yearToDatePercentage = year === currentYear ? (yearToDateSickDays / daysIntoYear) * 100 : 0

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

    // Calculate streaks and advanced stats
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    const streaks: number[] = []
    const recoveryPeriods: number[] = []
    
    const sortedDates = sickDays.map(d => new Date(d.date)).sort((a, b) => a.getTime() - b.getTime())
    const currentDateForStreaks = new Date()
    
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
          // End of a streak
          longestStreak = Math.max(longestStreak, tempStreak)
          streaks.push(tempStreak)
          
          // Record recovery period (gap between streaks)
          if (diffDays > 1) {
            recoveryPeriods.push(diffDays - 1)
          }
          
          tempStreak = 1
        }
      }
      
      // Check if this is part of current streak (ending today or yesterday)
      const diffFromToday = Math.floor((currentDateForStreaks.getTime() - sortedDates[i].getTime()) / (1000 * 60 * 60 * 24))
      if (diffFromToday <= 1 && i === sortedDates.length - 1) {
        currentStreak = tempStreak
      }
    }
    
    // Don't forget the last streak
    if (sortedDates.length > 0) {
      longestStreak = Math.max(longestStreak, tempStreak)
      streaks.push(tempStreak)
    }
    
    // Calculate average sick streak
    const averageSickStreak = streaks.length > 0 
      ? streaks.reduce((sum, streak) => sum + streak, 0) / streaks.length 
      : 0
    
    // Calculate recovery rate (average days between sick periods)
    const recoveryRate = recoveryPeriods.length > 0
      ? recoveryPeriods.reduce((sum, period) => sum + period, 0) / recoveryPeriods.length
      : 0

    // Calculate average intensity
    const totalIntensity = sickDays.reduce((sum, day) => {
      const intensity = typeof day.intensity === 'string' ? parseInt(day.intensity) : day.intensity
      return sum + intensity
    }, 0)
    const averageIntensity = totalSickDays > 0 ? totalIntensity / totalSickDays : 0

    return {
      // Overall Stats
      totalSickDays,
      percentageOfYear: Math.round(percentageOfYear * 100) / 100,
      yearToDatePercentage: Math.round(yearToDatePercentage * 100) / 100,
      averageIntensity: Math.round(averageIntensity * 100) / 100,
      
      // Pattern Stats
      mostCommonDay,
      recoveryRate: Math.round(recoveryRate * 100) / 100,
      
      // Streak Stats
      currentStreak,
      longestStreak,
      averageSickStreak: Math.round(averageSickStreak * 100) / 100
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

    const sickDays: DatabaseStatsRow[] = dateRangeData.rows
    const totalSickDays = sickDays.length
    
    // Calculate percentage of the date range (approximately 365 days for rolling 12 months)
    const start = new Date(startDate)
    const end = new Date(endDate)
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const percentageOfYear = (totalSickDays / totalDays) * 100

    // Calculate year-to-date percentage for current year
    const currentYearForRange = new Date().getFullYear()
    const yearStartForRange = new Date(currentYearForRange, 0, 1)
    const currentDateForRangeYTD = new Date()
    const daysIntoYearForRange = Math.floor((currentDateForRangeYTD.getTime() - yearStartForRange.getTime()) / (1000 * 60 * 60 * 24)) + 1
    
    // Get current year sick days from the range
    const currentYearSickDays = await client.query(
      `SELECT COUNT(*) as count
       FROM user_grids 
       WHERE user_id = $1 
       AND EXTRACT(YEAR FROM date) = $2
       AND intensity > 0
       AND date <= CURRENT_DATE`,
      [userId, currentYearForRange]
    )
    
    const yearToDateSickDaysCount = parseInt(currentYearSickDays.rows[0]?.count || '0')
    const yearToDatePercentage = (yearToDateSickDaysCount / daysIntoYearForRange) * 100

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

    // Calculate streaks and advanced stats
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    const streaks: number[] = []
    const recoveryPeriods: number[] = []
    
    const sortedDatesForRange = sickDays.map(d => new Date(d.date)).sort((a, b) => a.getTime() - b.getTime())
    const currentDateForRangeStreaks = new Date()
    
    for (let i = 0; i < sortedDatesForRange.length; i++) {
      if (i === 0) {
        tempStreak = 1
      } else {
        const prevDate = sortedDatesForRange[i - 1]
        const currDate = sortedDatesForRange[i]
        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
        
        if (diffDays === 1) {
          tempStreak++
        } else {
          // End of a streak
          longestStreak = Math.max(longestStreak, tempStreak)
          streaks.push(tempStreak)
          
          // Record recovery period (gap between streaks)
          if (diffDays > 1) {
            recoveryPeriods.push(diffDays - 1)
          }
          
          tempStreak = 1
        }
      }
      
      // Check if this is part of current streak (ending today or yesterday)
      const diffFromToday = Math.floor((currentDateForRangeStreaks.getTime() - sortedDatesForRange[i].getTime()) / (1000 * 60 * 60 * 24))
      if (diffFromToday <= 1 && i === sortedDatesForRange.length - 1) {
        currentStreak = tempStreak
      }
    }
    
    // Don't forget the last streak
    if (sortedDatesForRange.length > 0) {
      longestStreak = Math.max(longestStreak, tempStreak)
      streaks.push(tempStreak)
    }
    
    // Calculate average sick streak
    const averageSickStreak = streaks.length > 0 
      ? streaks.reduce((sum, streak) => sum + streak, 0) / streaks.length 
      : 0
    
    // Calculate recovery rate (average days between sick periods)
    const recoveryRate = recoveryPeriods.length > 0
      ? recoveryPeriods.reduce((sum, period) => sum + period, 0) / recoveryPeriods.length
      : 0

    // Calculate average intensity
    const totalIntensity = sickDays.reduce((sum, day) => {
      const intensity = typeof day.intensity === 'string' ? parseInt(day.intensity) : day.intensity
      return sum + intensity
    }, 0)
    const averageIntensity = totalSickDays > 0 ? totalIntensity / totalSickDays : 0

    return {
      // Overall Stats
      totalSickDays,
      percentageOfYear: Math.round(percentageOfYear * 100) / 100,
      yearToDatePercentage: Math.round(yearToDatePercentage * 100) / 100,
      averageIntensity: Math.round(averageIntensity * 100) / 100,
      
      // Pattern Stats
      mostCommonDay,
      recoveryRate: Math.round(recoveryRate * 100) / 100,
      
      // Streak Stats
      currentStreak,
      longestStreak,
      averageSickStreak: Math.round(averageSickStreak * 100) / 100
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
    // Generate username from email if not exists
    let username = null
    if (user.email) {
      username = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-')
    }

    // First, try to find existing user by email
    if (user.email) {
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [user.email]
      )
      
      if (existingUser.rows.length > 0) {
        const existingId = existingUser.rows[0].id
        
        // If the existing user has a different ID, we need to migrate data
        if (existingId !== user.id) {
          await client.query('BEGIN')
          
          try {
            // First, create the new user record
            await client.query(
              `INSERT INTO users (id, email, name, image, username, is_public, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, FALSE, NOW(), NOW())
               ON CONFLICT (id) DO NOTHING`,
              [user.id, null, user.name || null, user.image || null, username]
            )
            
            // Copy all grid data to the new user ID
            await client.query(
              `INSERT INTO user_grids (user_id, date, intensity, created_at, updated_at)
               SELECT $1, date, intensity, created_at, updated_at 
               FROM user_grids 
               WHERE user_id = $2
               ON CONFLICT (user_id, date) DO NOTHING`,
              [user.id, existingId]
            )
            
            // Delete old grid data
            await client.query(
              'DELETE FROM user_grids WHERE user_id = $1',
              [existingId]
            )
            
            // Delete old user record
            await client.query(
              'DELETE FROM users WHERE id = $1',
              [existingId]
            )
            
            // Update the new user record with the email and other info
            await client.query(
              `UPDATE users SET 
                 email = $2,
                 name = COALESCE($3, users.name),
                 image = COALESCE($4, users.image),
                 username = COALESCE(users.username, $5),
                 updated_at = NOW()
               WHERE id = $1`,
              [user.id, user.email, user.name || null, user.image || null, username]
            )
            
            await client.query('COMMIT')
            return
          } catch (error) {
            await client.query('ROLLBACK')
            throw error
          }
        } else {
          // User exists with same ID, just update their info
          await client.query(
            `UPDATE users SET 
               name = COALESCE($2, users.name),
               image = COALESCE($3, users.image),
               username = COALESCE(users.username, $4),
               updated_at = NOW()
             WHERE id = $1`,
            [user.id, user.name || null, user.image || null, username]
          )
          return
        }
      }
    }

    // If no existing user, insert normally
    await client.query(
      `INSERT INTO users (id, email, name, image, username)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) 
       DO UPDATE SET 
         email = COALESCE($2, users.email),
         name = COALESCE($3, users.name),
         image = COALESCE($4, users.image),
         username = COALESCE(users.username, $5),
         updated_at = NOW()`,
      [user.id, user.email || null, user.name || null, user.image || null, username]
    )
  } catch (error) {
    console.error('Error ensuring user exists:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function getUserByUsername(username: string) {
  const client = await pool.connect()
  try {
    const result = await client.query(
      'SELECT id, email, name, image, username, is_public FROM users WHERE username = $1',
      [username]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error fetching user by username:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function updateUserPrivacy(userId: string, isPublic: boolean) {
  const client = await pool.connect()
  try {
    await client.query(
      'UPDATE users SET is_public = $1, updated_at = NOW() WHERE id = $2',
      [isPublic, userId]
    )
  } catch (error) {
    console.error('Error updating user privacy:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function updateUsername(userId: string, newUsername: string) {
  const client = await pool.connect()
  try {
    await client.query(
      'UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2',
      [newUsername, userId]
    )
  } catch (error) {
    console.error('Error updating username:', error)
    throw error
  } finally {
    client.release()
  }
}