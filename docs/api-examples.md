# API examples

Use a locally provisioned key in `$API_KEY`; follow README's secure input instructions. These examples assume `npm run dev` is running. IDs below come from the returned resources; never supply `tenantId` in an input body.

## Create customer and service

```sh
curl -i http://localhost:8787/v1/customers \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"name":"Demo Customer","email":"demo@example.com","phone":"+353 1234567"}'

curl -i http://localhost:8787/v1/services \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"name":"Consultation","description":"Introductory session","durationMinutes":30}'
```

Both return 201 and a `Location` header. Customer responses have this structure (UUIDs/timestamps are illustrative):

```json
{
  "data": {
    "id": "cf058dc6-54d2-4936-ace1-8f1fa9488e03",
    "tenantId": "6eb8dcc6-6871-4e28-acf1-0acb599244ea",
    "name": "Demo Customer",
    "email": "demo@example.com",
    "phone": "+353 1234567",
    "active": true,
    "createdAt": "2027-01-01T12:00:00.000Z",
    "updatedAt": "2027-01-01T12:00:00.000Z"
  }
}
```

## Create booking

Replace the customer/service UUIDs with values returned by your local API.

```sh
curl -i http://localhost:8787/v1/bookings \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"customerId":"cf058dc6-54d2-4936-ace1-8f1fa9488e03","serviceId":"a9e8576f-1511-4e8b-a63a-c265754bfed7","startAt":"2027-01-15T10:00:00.000Z"}'
```

A 30 minute service produces `endAt: "2027-01-15T10:30:00.000Z"`. Creating an overlapping booking returns 409:

```json
{
  "error": {
    "code": "booking_conflict",
    "message": "The time slot is unavailable.",
    "requestId": "67dc6ab6-4ed4-43f6-a988-67fe49ec1bdf"
  }
}
```

## List, update, deactivate, cancel

Set `$CUSTOMER_ID`, `$SERVICE_ID` and `$BOOKING_ID` from your responses.

```sh
curl -H "Authorization: Bearer $API_KEY" \
  'http://localhost:8787/v1/bookings?status=active&limit=10&offset=0&from=2027-01-01T00:00:00.000Z&to=2027-02-01T00:00:00.000Z'

curl -X PATCH "http://localhost:8787/v1/customers/$CUSTOMER_ID" \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"name":"Updated Demo"}'

curl -X DELETE "http://localhost:8787/v1/services/$SERVICE_ID" \
  -H "Authorization: Bearer $API_KEY"

curl -X POST "http://localhost:8787/v1/bookings/$BOOKING_ID/cancel" \
  -H "Authorization: Bearer $API_KEY"
```

DELETE returns an empty 204 response. Cancel returns 200 with the cancelled booking and releases its interval. Sending either action again is safe; unknown or foreign IDs return 404. Changes to a service do not rewrite existing booking end times.
