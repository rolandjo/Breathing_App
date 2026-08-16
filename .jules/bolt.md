## 2024-08-16 - Array allocations in animation loops
**Learning:** Recomputing arrays via `.filter` on every requestAnimationFrame (60 times a second) creates noticeable garbage collection overhead even for small arrays, which can introduce micro-stutters during animations.
**Action:** Always memoize derived arrays in tight render loops based on the underlying state that generates them.
