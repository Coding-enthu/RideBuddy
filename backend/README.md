# RideBuddy Backend API Guide (for Frontend)

This backend is an Express API that provides:

- hazard reporting and hazard retrieval
- route generation with hazard-aware scoring

Base URL (local):

- `http://localhost:5000`

## Quick Health Check

### `GET /`

Returns a simple health string.

Response example:

```json
"API is running 🚀"
```

---

## 1) Get Best Route (Hazard-Aware)

### `GET /api/route`

Computes multiple OSRM routes and returns the best route after applying hazard penalties.

### Query Params

- `from` (required): `lng,lat`
- `to` (required): `lng,lat`

Example:

```http
GET /api/route?from=88.3639,22.5726&to=88.4339,22.6026
```

### Success Response Shape

```json
{
	"bestRoute": {
		"distance": 12345,
		"duration": 1200,
		"geometry": {
			"type": "LineString",
			"coordinates": [
				[88.36, 22.57],
				[88.37, 22.58]
			]
		}
	},
	"allRoutes": [
		{
			"distance": 12345,
			"duration": 1200,
			"geometry": {
				"type": "LineString",
				"coordinates": [
					[88.36, 22.57],
					[88.37, 22.58]
				]
			}
		}
	],
	"analysis": {
		"score": 1500,
		"hazardCount": 3,
		"penalty": 300,
		"typeBreakdown": {
			"pothole": 2,
			"waterlogging": 1
		}
	}
}
```

### Error Responses

- `400` when `from` or `to` is missing

```json
{ "error": "from and to required" }
```

- `500` for server/internal errors

### Frontend Usage (Axios)

```js
const res = await axios.get("http://localhost:5000/api/route", {
	params: {
		from: `${fromLng},${fromLat}`,
		to: `${toLng},${toLat}`,
	},
});

const bestRoute = res.data.bestRoute;
const line = bestRoute.geometry; // GeoJSON LineString
```

> Note: Use `bestRoute.geometry` for drawing the selected path. If you want alternatives, read `allRoutes`.

---

## 2) Hazards API

### `POST /api/hazards`

Create a hazard record.

Request body:

```json
{
	"type": "pothole",
	"lat": 22.5726,
	"lng": 88.3639,
	"severity": 2
}
```

Fields:

- `type` (string)
- `lat` (number)
- `lng` (number)
- `severity` (number, optional, defaults to `1`)

Success response (`201`): inserted hazard row.

---

### `GET /api/hazards`

Returns hazards.

#### Mode A: All hazards

```http
GET /api/hazards
```

#### Mode B: Hazards within a bounding box

```http
GET /api/hazards?minLat=22.50&maxLat=22.70&minLng=88.20&maxLng=88.50
```

Query params for bbox mode:

- `minLat`
- `maxLat`
- `minLng`
- `maxLng`

If `minLat` is not provided, backend returns all hazards.

---

## Frontend Integration Notes

- Current CORS is enabled globally (`app.use(cors())`), so local frontend can call API directly.
- Route endpoint path is **`/api/route`** (not `/route`).
- Route query param names are **`from`** and **`to`** (not `start`/`end`).
- Coordinate format expected by backend route API is `lng,lat`.

---

## Local Run (Backend)

1. Add `.env` file in `backend/` with:

```env
DATABASE_URL=your_postgres_connection_string
PORT=5000
```

2. Install and run:

```bash
npm install
npm run dev
```

Server starts on `http://localhost:5000` by default.
