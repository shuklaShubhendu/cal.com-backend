require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { format, addMinutes, isBefore } = require('date-fns');
const { sendBookingConfirmation, sendBookingCancellation } = require('./lib/mailer');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// ==================== API ROUTES ====================

// User Routes
app.get('/api/user', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = 1');
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/user', async (req, res) => {
  const { name, email, username, timezone } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, username = $3, timezone = $4 WHERE id = 1 RETURNING *',
      [name, email, username, timezone]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Event Types Routes
app.get('/api/event-types', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT et.*, u.username 
      FROM event_types et 
      JOIN users u ON et.user_id = u.id 
      WHERE et.user_id = 1
      ORDER BY et.id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching event types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/event-types/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const eventResult = await pool.query(`
      SELECT et.*, u.username 
      FROM event_types et 
      JOIN users u ON et.user_id = u.id 
      WHERE et.id = $1
    `, [id]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    const questionsResult = await pool.query(
      'SELECT * FROM questions WHERE event_type_id = $1',
      [id]
    );

    res.json({ ...eventResult.rows[0], questions: questionsResult.rows });
  } catch (error) {
    console.error('Error fetching event type:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/event-types', async (req, res) => {
  const { title, description, duration, slug, color, buffer_before, buffer_after, questions } = req.body;

  try {
    // Check for duplicate slug
    const existing = await pool.query(
      'SELECT id FROM event_types WHERE user_id = 1 AND slug = $1',
      [slug]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An event type with this URL slug already exists' });
    }

    const result = await pool.query(`
      INSERT INTO event_types (user_id, title, description, duration, slug, color, is_active, buffer_before, buffer_after)
      VALUES (1, $1, $2, $3, $4, $5, true, $6, $7)
      RETURNING *
    `, [title, description || '', duration || 30, slug, color || '#7C3AED', buffer_before || 0, buffer_after || 0]);

    const eventType = result.rows[0];

    // Add questions if provided
    if (questions?.length > 0) {
      for (const q of questions) {
        await pool.query(
          'INSERT INTO questions (event_type_id, question, required, question_type) VALUES ($1, $2, $3, $4)',
          [eventType.id, q.question, q.required || false, q.question_type || 'text']
        );
      }
    }

    res.status(201).json(eventType);
  } catch (error) {
    console.error('Error creating event type:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/event-types/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, description, duration, slug, color, is_active, buffer_before, buffer_after, questions } = req.body;

  try {
    // Check for duplicate slug (excluding current)
    const existing = await pool.query(
      'SELECT id FROM event_types WHERE user_id = 1 AND slug = $1 AND id != $2',
      [slug, id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An event type with this URL slug already exists' });
    }

    const result = await pool.query(`
      UPDATE event_types 
      SET title = $1, description = $2, duration = $3, slug = $4, color = $5, 
          is_active = $6, buffer_before = $7, buffer_after = $8
      WHERE id = $9 AND user_id = 1
      RETURNING *
    `, [title, description || '', duration, slug, color, is_active !== false, buffer_before || 0, buffer_after || 0, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    // Update questions if provided
    if (questions !== undefined) {
      await pool.query('DELETE FROM questions WHERE event_type_id = $1', [id]);
      for (const q of questions) {
        await pool.query(
          'INSERT INTO questions (event_type_id, question, required, question_type) VALUES ($1, $2, $3, $4)',
          [id, q.question, q.required || false, q.question_type || 'text']
        );
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating event type:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/event-types/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('DELETE FROM event_types WHERE id = $1 AND user_id = 1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event type:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Availability Routes
app.get('/api/availability', async (req, res) => {
  try {
    const availResult = await pool.query(
      'SELECT * FROM availability WHERE user_id = 1 ORDER BY id'
    );

    const availabilities = await Promise.all(availResult.rows.map(async (avail) => {
      const schedules = await pool.query(
        'SELECT * FROM schedules WHERE availability_id = $1',
        [avail.id]
      );
      const overrides = await pool.query(
        'SELECT * FROM overrides WHERE availability_id = $1',
        [avail.id]
      );
      return {
        ...avail,
        schedules: schedules.rows,
        overrides: overrides.rows
      };
    }));

    res.json(availabilities);
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/availability', async (req, res) => {
  const { name, timezone, schedules } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO availability (user_id, name, timezone, is_default)
      VALUES (1, $1, $2, false)
      RETURNING *
    `, [name || 'Custom Schedule', timezone || 'UTC']);

    const avail = result.rows[0];

    if (schedules?.length > 0) {
      for (const s of schedules) {
        await pool.query(
          'INSERT INTO schedules (availability_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)',
          [avail.id, s.day_of_week, s.start_time, s.end_time]
        );
      }
    }

    const schedulesResult = await pool.query(
      'SELECT * FROM schedules WHERE availability_id = $1',
      [avail.id]
    );

    res.status(201).json({ ...avail, schedules: schedulesResult.rows });
  } catch (error) {
    console.error('Error creating availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/availability/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, timezone, schedules, is_default } = req.body;

  try {
    if (is_default) {
      await pool.query('UPDATE availability SET is_default = false WHERE user_id = 1');
    }

    const result = await pool.query(`
      UPDATE availability SET name = $1, timezone = $2, is_default = $3
      WHERE id = $4 AND user_id = 1
      RETURNING *
    `, [name, timezone, is_default || false, id]);

    if (schedules !== undefined) {
      await pool.query('DELETE FROM schedules WHERE availability_id = $1', [id]);
      for (const s of schedules) {
        await pool.query(
          'INSERT INTO schedules (availability_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)',
          [id, s.day_of_week, s.start_time, s.end_time]
        );
      }
    }

    const schedulesResult = await pool.query(
      'SELECT * FROM schedules WHERE availability_id = $1',
      [id]
    );

    res.json({ ...result.rows[0], schedules: schedulesResult.rows });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/availability/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('DELETE FROM availability WHERE id = $1 AND user_id = 1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Date Overrides
app.post('/api/availability/:id/overrides', async (req, res) => {
  const availId = parseInt(req.params.id);
  const { date, start_time, end_time, is_blocked } = req.body;

  try {
    // Check for existing override
    const existing = await pool.query(
      'SELECT * FROM overrides WHERE availability_id = $1 AND date = $2',
      [availId, date]
    );

    if (existing.rows.length > 0) {
      const result = await pool.query(`
        UPDATE overrides SET start_time = $1, end_time = $2, is_blocked = $3
        WHERE availability_id = $4 AND date = $5
        RETURNING *
      `, [start_time, end_time, is_blocked || false, availId, date]);
      return res.json(result.rows[0]);
    }

    const result = await pool.query(`
      INSERT INTO overrides (availability_id, date, start_time, end_time, is_blocked)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [availId, date, start_time || null, end_time || null, is_blocked || false]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding override:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/availability/:id/overrides/:overrideId', async (req, res) => {
  const availId = parseInt(req.params.id);
  const overrideId = parseInt(req.params.overrideId);
  try {
    await pool.query(
      'DELETE FROM overrides WHERE id = $1 AND availability_id = $2',
      [overrideId, availId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting override:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bookings Routes
app.get('/api/bookings', async (req, res) => {
  const { status, type } = req.query;
  try {
    let query = `
      SELECT b.*, et.title as event_title, et.duration, et.color
      FROM bookings b
      JOIN event_types et ON b.event_type_id = et.id
      WHERE et.user_id = 1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND b.status = $${params.length}`;
    }

    if (type === 'upcoming') {
      query += ` AND b.start_time >= NOW() AND b.status = 'confirmed' ORDER BY b.start_time ASC`;
    } else if (type === 'past') {
      query += ` AND b.start_time < NOW() ORDER BY b.start_time DESC`;
    } else {
      query += ` ORDER BY b.start_time DESC`;
    }

    const result = await pool.query(query, params);

    // Get answers for each booking
    const bookings = await Promise.all(result.rows.map(async (booking) => {
      const answersResult = await pool.query(`
        SELECT a.*, q.question
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        WHERE a.booking_id = $1
      `, [booking.id]);
      return { ...booking, answers: answersResult.rows };
    }));

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/bookings/:uid', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, et.title as event_title, et.duration, et.color, et.slug, u.name as host_name, u.username, u.email as host_email
      FROM bookings b
      JOIN event_types et ON b.event_type_id = et.id
      JOIN users u ON et.user_id = u.id
      WHERE b.uid = $1
    `, [req.params.uid]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/bookings/:uid/cancel', async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE bookings SET status = 'cancelled' WHERE uid = $1 RETURNING *",
      [req.params.uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const updatedBooking = result.rows[0];

    // Get full details for email
    const fullBookingResult = await pool.query(`
      SELECT b.*, et.title as event_title, u.name as host_name, u.email as host_email
      FROM bookings b
      JOIN event_types et ON b.event_type_id = et.id
      JOIN users u ON et.user_id = u.id
      WHERE b.id = $1
    `, [updatedBooking.id]);

    if (fullBookingResult.rows.length > 0) {
      // Run asynchronously
      sendBookingCancellation(fullBookingResult.rows[0]).catch(console.error);
    }

    res.json(updatedBooking);
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/bookings/:uid/reschedule', async (req, res) => {
  const { start_time, end_time } = req.body;
  try {
    // Get the booking
    const bookingResult = await pool.query('SELECT * FROM bookings WHERE uid = $1', [req.params.uid]);
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const booking = bookingResult.rows[0];

    // Check for conflicts
    const conflictResult = await pool.query(`
      SELECT id FROM bookings 
      WHERE event_type_id = $1 AND status = 'confirmed' AND id != $2
      AND ((start_time <= $3 AND end_time > $3) OR (start_time < $4 AND end_time >= $4))
    `, [booking.event_type_id, booking.id, start_time, end_time]);

    if (conflictResult.rows.length > 0) {
      return res.status(400).json({ error: 'This time slot is no longer available' });
    }

    const result = await pool.query(
      'UPDATE bookings SET start_time = $1, end_time = $2 WHERE uid = $3 RETURNING *',
      [start_time, end_time, req.params.uid]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error rescheduling booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== PUBLIC BOOKING ROUTES ====================

app.get('/api/public/:username', async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id, name, username, timezone FROM users WHERE username = $1',
      [req.params.username]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    const eventTypesResult = await pool.query(
      'SELECT id, title, description, duration, slug, color FROM event_types WHERE user_id = $1 AND is_active = true',
      [user.id]
    );

    res.json({ user, eventTypes: eventTypesResult.rows });
  } catch (error) {
    console.error('Error fetching public profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/public/:username/:slug', async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id, name, username, timezone FROM users WHERE username = $1',
      [req.params.username]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    const eventResult = await pool.query(
      'SELECT * FROM event_types WHERE user_id = $1 AND slug = $2 AND is_active = true',
      [user.id, req.params.slug]
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found' });
    }
    const eventType = eventResult.rows[0];

    const questionsResult = await pool.query(
      'SELECT * FROM questions WHERE event_type_id = $1',
      [eventType.id]
    );

    res.json({ user, eventType, questions: questionsResult.rows });
  } catch (error) {
    console.error('Error fetching public event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/public/:username/:slug/slots', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date is required' });

  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [req.params.username]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = userResult.rows[0].id;

    const eventResult = await pool.query(
      'SELECT * FROM event_types WHERE user_id = $1 AND slug = $2 AND is_active = true',
      [userId, req.params.slug]
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found' });
    }
    const eventType = eventResult.rows[0];

    const availResult = await pool.query(
      'SELECT * FROM availability WHERE user_id = $1 AND is_default = true',
      [userId]
    );
    if (availResult.rows.length === 0) {
      return res.json({ slots: [] });
    }
    const avail = availResult.rows[0];

    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    // Check for date override
    const overrideResult = await pool.query(
      'SELECT * FROM overrides WHERE availability_id = $1 AND date = $2',
      [avail.id, dateStr]
    );

    if (overrideResult.rows.length > 0 && overrideResult.rows[0].is_blocked) {
      return res.json({ slots: [] });
    }

    let schedule;
    if (overrideResult.rows.length > 0 && !overrideResult.rows[0].is_blocked) {
      schedule = overrideResult.rows[0];
    } else {
      const scheduleResult = await pool.query(
        'SELECT * FROM schedules WHERE availability_id = $1 AND day_of_week = $2',
        [avail.id, dayOfWeek]
      );
      schedule = scheduleResult.rows[0];
    }

    if (!schedule) return res.json({ slots: [] });

    // Parse times (handle Time type from PostgreSQL)
    const startTimeStr = typeof schedule.start_time === 'string'
      ? schedule.start_time
      : schedule.start_time.toString().slice(0, 5);
    const endTimeStr = typeof schedule.end_time === 'string'
      ? schedule.end_time
      : schedule.end_time.toString().slice(0, 5);

    const [startHour, startMin] = startTimeStr.split(':').map(Number);
    const [endHour, endMin] = endTimeStr.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Get existing bookings for this day
    const bookingsResult = await pool.query(`
      SELECT * FROM bookings 
      WHERE event_type_id = $1 AND status = 'confirmed'
      AND DATE(start_time) = $2
    `, [eventType.id, dateStr]);

    const existingBookings = bookingsResult.rows;
    const duration = eventType.duration;
    const bufferBefore = eventType.buffer_before || 0;
    const bufferAfter = eventType.buffer_after || 0;

    const slots = [];
    for (let mins = startMinutes; mins + duration <= endMinutes; mins += 15) {
      const slotStart = new Date(selectedDate);
      slotStart.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
      const slotEnd = addMinutes(slotStart, duration);

      if (isBefore(slotStart, new Date())) continue;

      const hasConflict = existingBookings.some(b => {
        const bs = new Date(b.start_time);
        const be = new Date(b.end_time);
        const bufferedStart = addMinutes(bs, -bufferBefore);
        const bufferedEnd = addMinutes(be, bufferAfter);
        return (slotStart >= bufferedStart && slotStart < bufferedEnd) ||
          (slotEnd > bufferedStart && slotEnd <= bufferedEnd) ||
          (slotStart <= bufferedStart && slotEnd >= bufferedEnd);
      });

      if (!hasConflict) {
        slots.push({
          time: format(slotStart, 'HH:mm'),
          start: slotStart.toISOString(),
          end: slotEnd.toISOString()
        });
      }
    }

    res.json({ slots });
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/public/book', async (req, res) => {
  const { event_type_id, booker_name, booker_email, start_time, end_time, notes, answers } = req.body;

  if (!event_type_id || !booker_name || !booker_email || !start_time || !end_time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check for conflicts
    const conflictResult = await pool.query(`
      SELECT id FROM bookings 
      WHERE event_type_id = $1 AND status = 'confirmed'
      AND ((start_time <= $2 AND end_time > $2) OR (start_time < $3 AND end_time >= $3))
    `, [event_type_id, start_time, end_time]);

    if (conflictResult.rows.length > 0) {
      return res.status(400).json({ error: 'This time slot is no longer available' });
    }

    const result = await pool.query(`
      INSERT INTO bookings (event_type_id, booker_name, booker_email, start_time, end_time, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [event_type_id, booker_name, booker_email, start_time, end_time, notes || '']);

    const booking = result.rows[0];

    // Add answers if provided
    if (answers?.length > 0) {
      for (const a of answers) {
        if (a.answer?.trim()) {
          await pool.query(
            'INSERT INTO answers (booking_id, question_id, answer) VALUES ($1, $2, $3)',
            [booking.id, a.question_id, a.answer]
          );
        }
      }
    }

    // Get event details for response
    const eventResult = await pool.query(`
      SELECT et.title as event_title, et.duration, u.name as host_name, u.username, u.email as host_email
      FROM event_types et
      JOIN users u ON et.user_id = u.id
      WHERE et.id = $1
    `, [event_type_id]);

    const fullBooking = { ...booking, ...eventResult.rows[0] };

    // Send email asynchronously
    sendBookingConfirmation(fullBooking).catch(console.error);

    res.status(201).json(fullBooking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
