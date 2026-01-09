# Scaller Backend API

A robust RESTful API backend for **Scaller** - a Cal.com clone scheduling platform built with Node.js and Express.js.

![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)
![Express.js](https://img.shields.io/badge/Express.js-v4.22-blue.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)
![License](https://img.shields.io/badge/License-ISC-yellow.svg)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Assumptions](#assumptions)

---

## 🎯 Overview

This backend API powers a fully functional scheduling and booking application similar to Cal.com. It handles:

- **Event Types Management** - Create, read, update, delete event types with custom durations and booking questions
- **Availability Scheduling** - Define weekly schedules with timezone support and date overrides
- **Booking System** - Secure booking creation with double-booking prevention and conflict detection
- **Email Notifications** - Automated confirmation and cancellation emails using Nodemailer

---

## 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **Express.js** | Web framework for REST API |
| **PostgreSQL** | Relational database |
| **pg (node-postgres)** | PostgreSQL client for Node.js |
| **date-fns** | Date manipulation and formatting |
| **Nodemailer** | Email sending service |
| **CORS** | Cross-origin resource sharing |
| **dotenv** | Environment variable management |
| **uuid** | Unique identifier generation |

---

## 🗄 Database Schema

The database follows a well-structured relational design with proper foreign key relationships and indexing for optimal performance.

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│    users     │       │   event_types    │       │   bookings   │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ id (PK)      │──────<│ user_id (FK)     │──────<│ event_type_id│
│ name         │       │ id (PK)          │       │ id (PK)      │
│ email        │       │ title            │       │ uid (UUID)   │
│ username     │       │ description      │       │ booker_name  │
│ timezone     │       │ duration         │       │ booker_email │
│ created_at   │       │ slug             │       │ start_time   │
└──────────────┘       │ color            │       │ end_time     │
        │              │ is_active        │       │ status       │
        │              │ buffer_before    │       │ notes        │
        │              │ buffer_after     │       │ created_at   │
        │              │ created_at       │       └──────────────┘
        │              └──────────────────┘              ▲
        │                      │                         │
        ▼                      ▼                         │
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│ availability │       │   questions      │       │   answers    │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)          │       │ id (PK)      │
│ user_id (FK) │       │ event_type_id(FK)│       │ booking_id   │
│ name         │       │ question         │──────>│ question_id  │
│ timezone     │       │ required         │       │ answer       │
│ is_default   │       │ question_type    │       └──────────────┘
│ created_at   │       └──────────────────┘
└──────────────┘
        │
        ├──────────────────┐
        ▼                  ▼
┌──────────────┐   ┌──────────────┐
│  schedules   │   │  overrides   │
├──────────────┤   ├──────────────┤
│ id (PK)      │   │ id (PK)      │
│ availabil... │   │ availabil... │
│ day_of_week  │   │ date         │
│ start_time   │   │ start_time   │
│ end_time     │   │ end_time     │
└──────────────┘   │ is_blocked   │
                   └──────────────┘
```

### Tables Description

#### 1. `users` - User accounts
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL (PK) | Auto-incrementing primary key |
| `name` | VARCHAR(255) | User's display name |
| `email` | VARCHAR(255) | Unique email address |
| `username` | VARCHAR(100) | Unique username for public URLs |
| `timezone` | VARCHAR(100) | User's timezone (default: 'UTC') |
| `created_at` | TIMESTAMP | Account creation timestamp |

#### 2. `event_types` - Schedulable meeting types
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL (PK) | Auto-incrementing primary key |
| `user_id` | INTEGER (FK) | References users.id |
| `title` | VARCHAR(255) | Event title (e.g., "30 Minute Meeting") |
| `description` | TEXT | Optional event description |
| `duration` | INTEGER | Meeting duration in minutes |
| `slug` | VARCHAR(100) | URL-friendly unique identifier |
| `color` | VARCHAR(20) | Hex color code for UI display |
| `is_active` | BOOLEAN | Whether event accepts bookings |
| `buffer_before` | INTEGER | Buffer time before meetings (minutes) |
| `buffer_after` | INTEGER | Buffer time after meetings (minutes) |
| `created_at` | TIMESTAMP | Creation timestamp |

**Unique Constraint:** `(user_id, slug)` - Ensures unique slugs per user

#### 3. `availability` - Availability schedule profiles
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL (PK) | Auto-incrementing primary key |
| `user_id` | INTEGER (FK) | References users.id |
| `name` | VARCHAR(255) | Schedule name (e.g., "Working Hours") |
| `timezone` | VARCHAR(100) | Timezone for this schedule |
| `is_default` | BOOLEAN | Whether this is the default schedule |
| `created_at` | TIMESTAMP | Creation timestamp |

#### 4. `schedules` - Weekly time slots
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL (PK) | Auto-incrementing primary key |
| `availability_id` | INTEGER (FK) | References availability.id |
| `day_of_week` | INTEGER | 0 (Sunday) to 6 (Saturday) |
| `start_time` | TIME | Slot start time |
| `end_time` | TIME | Slot end time |

**Constraint:** `day_of_week` must be between 0 and 6

#### 5. `overrides` - Date-specific availability changes
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL (PK) | Auto-incrementing primary key |
| `availability_id` | INTEGER (FK) | References availability.id |
| `date` | DATE | Specific date to override |
| `start_time` | TIME | Override start time (null if blocked) |
| `end_time` | TIME | Override end time (null if blocked) |
| `is_blocked` | BOOLEAN | Whether the entire day is blocked |

#### 6. `bookings` - Scheduled meetings
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL (PK) | Auto-incrementing primary key |
| `uid` | UUID | Public unique identifier for sharing |
| `event_type_id` | INTEGER (FK) | References event_types.id |
| `booker_name` | VARCHAR(255) | Guest's name |
| `booker_email` | VARCHAR(255) | Guest's email |
| `start_time` | TIMESTAMP | Booking start datetime |
| `end_time` | TIMESTAMP | Booking end datetime |
| `status` | VARCHAR(50) | 'confirmed', 'cancelled', 'rescheduled' |
| `notes` | TEXT | Optional booking notes |
| `created_at` | TIMESTAMP | Booking creation timestamp |

#### 7. `questions` - Custom booking questions
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL (PK) | Auto-incrementing primary key |
| `event_type_id` | INTEGER (FK) | References event_types.id |
| `question` | TEXT | Question text |
| `required` | BOOLEAN | Whether answer is required |
| `question_type` | VARCHAR(50) | 'text', 'textarea', 'select', etc. |

#### 8. `answers` - Responses to custom questions
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL (PK) | Auto-incrementing primary key |
| `booking_id` | INTEGER (FK) | References bookings.id |
| `question_id` | INTEGER (FK) | References questions.id |
| `answer` | TEXT | User's response |

### Database Indexes

Optimized indexes for frequently queried columns:

```sql
CREATE INDEX idx_event_types_user_id ON event_types(user_id);
CREATE INDEX idx_event_types_slug ON event_types(slug);
CREATE INDEX idx_availability_user_id ON availability(user_id);
CREATE INDEX idx_schedules_availability_id ON schedules(availability_id);
CREATE INDEX idx_bookings_event_type_id ON bookings(event_type_id);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_status ON bookings(status);
```

### Cascade Deletion

All foreign keys use `ON DELETE CASCADE` to maintain referential integrity:
- Deleting a user removes all their event types, availability schedules, and related data
- Deleting an event type removes all its bookings and custom questions
- Deleting an availability schedule removes all its schedules and overrides

---

## 📡 API Endpoints

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/user` | Get current user profile |
| `PUT` | `/api/user` | Update user profile |

### Event Types

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/event-types` | List all event types |
| `GET` | `/api/event-types/:id` | Get event type by ID |
| `POST` | `/api/event-types` | Create new event type |
| `PUT` | `/api/event-types/:id` | Update event type |
| `DELETE` | `/api/event-types/:id` | Delete event type |

### Availability

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/availability` | List all availability schedules |
| `POST` | `/api/availability` | Create new availability |
| `PUT` | `/api/availability/:id` | Update availability |
| `DELETE` | `/api/availability/:id` | Delete availability |
| `POST` | `/api/availability/:id/overrides` | Add date override |
| `DELETE` | `/api/availability/:id/overrides/:overrideId` | Remove date override |

### Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/bookings` | List bookings (with filters) |
| `GET` | `/api/bookings/:uid` | Get booking by UID |
| `POST` | `/api/bookings` | Create new booking |
| `PATCH` | `/api/bookings/:id/cancel` | Cancel a booking |
| `PATCH` | `/api/bookings/:id/reschedule` | Reschedule a booking |

### Public Booking

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/public/:username/:slug` | Get public event details |
| `GET` | `/api/public/:username/:slug/slots` | Get available time slots |

---

## 🚀 Setup Instructions

### Prerequisites

- **Node.js** v18 or higher
- **PostgreSQL** 15 or higher (or use Supabase)
- **npm** or **yarn**

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd scaller-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials (see [Environment Variables](#environment-variables))

4. **Set up the database**
   
   Run the schema in your PostgreSQL database:
   ```bash
   psql -d your_database -f schema.sql
   ```
   
   Or if using Supabase, paste the contents of `schema.sql` into the SQL Editor.

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the API**
   ```
   http://localhost:5001
   ```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with hot reload |

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Database Connection
DATABASE_URL=postgresql://username:password@host:5432/database

# Server Port (optional, defaults to 5001)
PORT=5001

# App URL for email links (optional)
NEXT_PUBLIC_APP_URL=https://your-frontend-url.com
```

### Database URL Format

For **Supabase**:
```
postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

For **Railway**:
```
postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/railway
```

---

## ☁️ Deployment

### Deploy to Railway

1. Push your code to GitHub
2. Connect Railway to your GitHub repository
3. Add environment variables in Railway dashboard:
   - `DATABASE_URL` - Your PostgreSQL connection string
4. Railway will auto-detect the Node.js app and deploy

### Deploy to Render

1. Create a new Web Service on Render
2. Connect to your GitHub repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables

---

## 📝 Assumptions

1. **Single User System** - The application assumes a single default user (id=1) is always logged in. No authentication system is implemented as per assignment requirements.

2. **Timezone Handling** - All times are stored in UTC and converted to user's timezone on the client side.

3. **Email Service** - Uses Ethereal Email (testing service) by default. In production, replace with actual SMTP credentials.

4. **Database Seeding** - The schema.sql includes seed data for:
   - One default user (Shubhendu Shukla)
   - Default availability (Mon-Fri, 9 AM - 5 PM)
   - Three sample event types (15min, 30min, 60min meetings)

5. **Booking Conflicts** - The system prevents double-booking by checking existing confirmed bookings for the same time slot.

6. **Buffer Times** - Buffer before/after meetings is supported but optional (defaults to 0 minutes).

---

## 📁 Project Structure

```
scaller-server/
├── index.js           # Main Express application with all routes
├── db.js              # PostgreSQL connection pool configuration
├── schema.sql         # Database schema and seed data
├── lib/
│   └── mailer.js      # Email utility functions
├── package.json       # Dependencies and scripts
├── .env.example       # Environment variables template
├── .gitignore         # Git ignore rules
└── README.md          # This file
```

---

## 🔗 Related

- [Scaller Frontend](https://github.com/your-username/scaller-client) - Next.js frontend application
- [Cal.com](https://cal.com) - Original inspiration

---

## 📄 License

ISC License - See [LICENSE](LICENSE) for details

---

**Built with ❤️ as part of SDE Intern Fullstack Assignment**
