import { redirect } from 'next/navigation'

// Login happens on the landing page; kept so old links land somewhere sensible.
export default function Callback() {
  redirect('/')
}
