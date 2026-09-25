---
title: Controller dependencies — composition root
description: Controllers are structs holding their dependencies, built once in router.InitializeRouter after the DB connects (composition root) and injected; no package-level var New(), no per-request construction; field order application → services → external clients.
globs: controllers/**/*.go,router/**/*.go
---

# Controller dependencies — built once at startup, injected

## Rule

- A resource controller is a **struct holding its dependencies**; handlers are **methods** on it.
- Its constructor `NewController()` builds those dependencies. It is called **only** from
  `router.InitializeRouter`, the **composition root**, which `main` runs **after**
  `database.ConnectToDatabase()`.
- Handlers reach orchestrators / services **through the struct fields** — never by calling a
  constructor themselves.
- Declare fields and build them in this order, for readability:
  1. **Application orchestrators** (`application/...`)
  2. **Level-1 services** (`services/...`)
  3. **External API clients** (`services/<api_name>/...`, see *External API clients*)

```go
// controllers/v1/order/order.go
type Controller struct {
	orders   *appOrder.Orchestrator
	invoices *srvInvoice.InvoiceService
	payments *paymentapi.Client
}

func NewController() *Controller {
	return &Controller{
		orders:   appOrder.New(),
		invoices: srvInvoice.NewInvoiceService(),
		payments: paymentapi.DefaultClient(),
	}
}

func (ctl *Controller) GetList(c *gin.Context) {
	orders, err := ctl.orders.GetList(c.Request.Context(), ...)
	...
}

// router/router.go — runs after the DB is connected
orderController := orderCtl.NewController()
v1route.GET("/orders", middleware.RequireAuth(), orderController.GetList)
```

## Forbidden

- **Package-level `var x = pkg.New()`** (or an `init()` doing the same). Go initializes package
  variables before `main` runs, so before the DB connects: a service that reads
  `database.GetDB()` in its constructor would keep a `nil` connection and fail on the first request.
- **Building dependencies inside a handler** (`appOrder.New()` on every request). It hides what the
  controller depends on, allocates the whole graph per request, and leaves no seam to swap a
  dependency in tests.

## Why

- One place (`InitializeRouter`) shows the whole dependency graph, built in a known order after
  the infrastructure it needs.
- Dependencies are explicit fields: a controller can be built with other implementations in tests.
- Services may keep taking their connection at construction (`database.GetDB()`), because the
  constructor now runs after the connection exists. Per-request state (context, transaction) still
  goes through `ctx` and `WithTx(tx)`, never through the struct.
