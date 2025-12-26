'use client'

import { useMemo, useState } from 'react'

export default function HeatmapSection({ volume, year }) {
  const [hoveredDay, setHoveredDay] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  
  const heatmapData = useMemo(() => {
    if (!volume?.daily_activity) return null
    
    const dailyActivity = volume.daily_activity
    
    const filteredActivity = {}
    Object.keys(dailyActivity).forEach(dateStr => {
      const dateYear = new Date(dateStr).getFullYear()
      if (dateYear === parseInt(year)) {
        filteredActivity[dateStr] = dailyActivity[dateStr]
      }
    })
    
    const dates = Object.keys(filteredActivity).sort()
    
    if (dates.length === 0) return null

    const startDate = new Date(dates[0])
    const endDate = new Date(dates[dates.length - 1])
    
    const monthsData = []
    let currentDate = new Date(startDate)
    currentDate.setDate(1)
    
    while (currentDate <= endDate) {
      const monthStart = new Date(currentDate)
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      const actualEnd = monthEnd > endDate ? endDate : monthEnd
      
      const daysInMonth = []
      const firstDayOfWeek = monthStart.getDay()
      
      for (let i = 0; i < firstDayOfWeek; i++) {
        daysInMonth.push(null)
      }
      
      let dayDate = new Date(monthStart)
      while (dayDate <= actualEnd) {
        const dateStr = dayDate.toISOString().split('T')[0]
        const activity = filteredActivity[dateStr]
        daysInMonth.push({
          date: dateStr,
          count: activity ? activity.total : 0,
          sent: activity ? activity.sent : 0,
          received: activity ? activity.received : 0,
        })
        dayDate.setDate(dayDate.getDate() + 1)
      }
      
      monthsData.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        days: daysInMonth,
      })
      
      currentDate.setMonth(currentDate.getMonth() + 1)
    }
    
    const allCounts = Object.values(filteredActivity).map(d => d.total)
    const maxCount = Math.max(...allCounts)
    
    const percentiles = [
      0,
      Math.ceil(maxCount * 0.25),
      Math.ceil(maxCount * 0.5),
      Math.ceil(maxCount * 0.75),
      maxCount
    ]
    
    return { monthsData, maxCount, percentiles, totalDays: dates.length }
  }, [volume?.daily_activity, year])

  if (!heatmapData) return null

  const getColor = (count) => {
    if (count === 0) return 'rgba(139, 92, 246, 0.08)'
    const { percentiles } = heatmapData
    
    if (count >= percentiles[4]) return '#ec4899'
    if (count >= percentiles[3]) return '#d946a6'
    if (count >= percentiles[2]) return '#c026d3'
    if (count >= percentiles[1]) return '#a855f7'
    return 'rgba(139, 92, 246, 0.3)'
  }

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="section" style={{ position: 'relative' }}>
      <h2 className="section-title">📅 Activity Heatmap</h2>
      
      {hoveredDay && (
        <div style={{
          position: 'fixed',
          left: `${tooltipPos.x}px`,
          top: `${tooltipPos.y}px`,
          transform: 'translate(-50%, -120%)',
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          color: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          border: '1px solid rgba(236, 72, 153, 0.3)',
          fontSize: '0.875rem',
          pointerEvents: 'none',
          zIndex: 1000,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        }}>
          <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#ec4899' }}>
            {new Date(hoveredDay.date).toLocaleDateString('en-US', { 
              weekday: 'short',
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
            <span style={{ fontWeight: '600', color: '#a855f7' }}>{hoveredDay.count}</span> total messages
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            marginTop: '0.25rem',
            fontSize: '0.75rem',
            opacity: 0.8,
          }}>
            <span>↑ {hoveredDay.sent} sent</span>
            <span>↓ {hoveredDay.received} received</span>
          </div>
        </div>
      )}
      
      <div style={{ 
        marginBottom: '2rem', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.75rem', 
        justifyContent: 'center', 
        flexWrap: 'wrap' 
      }}>
        <span style={{ fontSize: '0.875rem', opacity: 0.6 }}>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            style={{
              width: '18px',
              height: '18px',
              backgroundColor: getColor(heatmapData.percentiles[level]),
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '3px',
            }}
            title={`${heatmapData.percentiles[level]} messages`}
          />
        ))}
        <span style={{ fontSize: '0.875rem', opacity: 0.6 }}>More</span>
      </div>

      <div style={{ 
        overflowX: 'auto',
        paddingBottom: '1rem',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
      className="heatmap-scroll">
        <div style={{ 
          display: 'flex',
          gap: '1rem',
          minWidth: 'fit-content',
        }}>
          {heatmapData.monthsData.map((month, monthIdx) => (
            <div key={monthIdx} style={{ 
              textAlign: 'center',
              minWidth: '150px',
            }}>
              <div style={{ 
                fontSize: '0.75rem', 
                opacity: 0.6, 
                marginBottom: '0.75rem',
                fontWeight: '600',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                {month.month}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px',
                justifyContent: 'center',
                margin: '0 auto',
              }}>
                {month.days.map((day, dayIdx) => {
                  const isWeekend = dayIdx % 7 === 0 || dayIdx % 7 === 6
                  return (
                    <div
                      key={dayIdx}
                      style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: day ? getColor(day.count) : 'transparent',
                        border: day ? `1px solid ${isWeekend ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)'}` : 'none',
                        borderRadius: '3px',
                        cursor: day ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => {
                        if (day) {
                          e.currentTarget.style.transform = 'scale(1.4)'
                          e.currentTarget.style.boxShadow = '0 0 12px rgba(236, 72, 153, 0.6)'
                          e.currentTarget.style.zIndex = '10'
                          
                          const rect = e.currentTarget.getBoundingClientRect()
                          setTooltipPos({
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          })
                          setHoveredDay(day)
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (day) {
                          e.currentTarget.style.transform = 'scale(1)'
                          e.currentTarget.style.boxShadow = 'none'
                          e.currentTarget.style.zIndex = '1'
                          setHoveredDay(null)
                        }
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ 
        marginTop: '1.5rem', 
        textAlign: 'center', 
        fontSize: '0.875rem', 
        opacity: 0.5,
        display: 'flex',
        justifyContent: 'center',
        gap: '2rem',
        flexWrap: 'wrap',
      }}>
        <span>Active days in {year}: {heatmapData.totalDays}</span>
        <span>Peak: {heatmapData.maxCount} messages</span>
      </div>
    </div>
  )
}

