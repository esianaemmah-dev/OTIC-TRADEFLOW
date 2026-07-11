# TradeFlow MVP Progress

## Current Status

TradeFlow MVP has been started locally.

The current system supports:

1. Supplier quotation creation
2. Buyer financing request
3. Admin review
4. Finance request approval, rejection, or request for more information
5. Local JSON database storage
6. Frontend dashboard connected to backend API

## Current Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js, Express.js
- Database: Local JSON file
- Environment: Local Windows machine
- Cloud: Not yet deployed

## Working Backend Endpoints

- GET /
- GET /health
- POST /api/quotations
- GET /api/quotations/:id
- POST /api/finance-requests
- GET /api/admin/finance-requests
- PATCH /api/admin/finance-requests/:id/status

## Completed Workflow

Supplier creates quotation  
Buyer requests financing  
Admin reviews request  
Admin approves, rejects, or asks for more information  
Financier can be assigned manually  

## Next Planned Features

1. Buyer and supplier verification fields
2. Basic risk score calculation
3. WhatsApp quotation sharing improvement
4. Admin dashboard filtering
5. Replace JSON database with SQLite or PostgreSQL
6. Prepare GitHub repository
7. Prepare Azure deployment plan