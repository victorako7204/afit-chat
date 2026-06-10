# AFIT Chat - Module 3: Posts & Feed

## Cloudinary Image Transforms

All images use Cloudinary URL-based transforms (no SDK needed):

```
https://res.cloudinary.com/<CLOUD_NAME>/image/upload/w_400,q_auto:good,f_auto/<public_id>
```

| Parameter | Value | Description |
|-----------|-------|-------------|
| `w_400` / `w_600` | Width in pixels | Responsive via srcSet |
| `q_auto:good` | Auto quality | Balances quality/size |
| `f_auto` | Auto format | WebP/AVIF when supported |

**No SDK** — just construct URLs from public_id.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/posts?cursor=&limit=10&department=&authorId=` | Cursor-paginated feed |
| POST | `/api/v1/posts` | Create post |
| GET | `/api/v1/posts/:id` | Get single post (first 20 comments) |
| PUT | `/api/v1/posts/:id` | Edit post (15 min window) |
| DELETE | `/api/v1/posts/:id` | Soft delete post |
| POST | `/api/v1/posts/:id/like` | Toggle like |
| GET | `/api/v1/posts/:id/comments?cursor=&limit=20` | Cursor-paginated comments |
| POST | `/api/v1/posts/:id/comments` | Add comment |
| DELETE | `/api/v1/posts/:id/comments/:commentId` | Delete comment |
| GET | `/api/v1/posts/:id/identify-author` | Reveal real author of anonymous post (admin only) |

## Error Codes

- `POST_NOT_FOUND`: 404
- `NOT_AUTHORIZED`: 403
- `EDIT_WINDOW_EXPIRED`: 403 (15 min)
- `VALIDATION_ERROR`: 400
- `RATE_LIMITED`: 429 (10 posts/hour)
- `COMMENT_NOT_FOUND`: 404

## Testing

```bash
cd server
npm test -- --testPathPattern=posts --forceExit
```

## Testing Infinite Scroll

1. Seed database with 25+ posts
2. Observe that feed loads 10 at a time
3. Scroll to bottom — next 10 load via IntersectionObserver
4. Verify cursor pagination: no duplicates, no gaps
5. Pull-to-refresh resets cursor and fetches from start
