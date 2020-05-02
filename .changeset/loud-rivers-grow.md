---
"node-red-contrib-xstate-machine": major
---

Breaking change: Event data read from an external message's payload property is now also available within the payload property of the event. You will have to change your statemachines that process external event data accordingly.
