# Echelon

A lightweight web tool for composing order-of-battle trees. Each unit is a first-class data object (name, short code, echelon, role color, optional image, equipment list); the tree is just a view. Drag a card onto another card to reparent it, drop onto the root zone to promote it, drop into the left palette to unassign it. Everything persists to `localStorage` so you can close the tab and come back.

## Run

```
task install
task dev
```

Other tasks: `task build`, `task preview`, `task typecheck`, `task lint`, `task clean`. See `task -l` for descriptions.
