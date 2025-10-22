import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import api from '../../lib/api'

interface CurrentUser {
  id: number
  email: string
  full_name: string
  role: 'Admin' | 'ProjectManager' | 'Viewer'
}

interface AuthState {
  token: string | null
  loading: boolean
  error: string | null
  registered: boolean
  me: CurrentUser | null
}

const initialState: AuthState = { token: localStorage.getItem('token'), loading: false, error: null, registered: false, me: null }

export const login = createAsyncThunk(
  'auth/login',
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const form = new URLSearchParams()
      form.append('username', payload.email)
      form.append('password', payload.password)
      const { data } = await api.post('/auth/token', form)
      return data.access_token as string
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail ?? 'Login failed')
    }
  }
)

export const register = createAsyncThunk(
  'auth/register',
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const form = new URLSearchParams()
      form.append('username', payload.email)
      form.append('password', payload.password)
      await api.post('/auth/register', form)
      return true
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail ?? 'Register failed')
    }
  }
)

export const fetchMe = createAsyncThunk('auth/fetchMe', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<CurrentUser>('/users/me')
    return data
  } catch (e: any) {
    // Keep token; surface error so UI can handle gracefully without flashing/logout
    return rejectWithValue(e.response?.data?.detail ?? 'Failed to load user')
  }
})

const slice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.token = null
      state.me = null
      localStorage.removeItem('token')
    },
    clearAuthState(state){
      state.error = null
      state.registered = false
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        state.token = action.payload
        localStorage.setItem('token', action.payload)
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error = (action.payload as string) ?? 'Login failed'
      })
      .addCase(register.pending, (state) => {
        state.loading = true
        state.error = null
        state.registered = false
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false
        state.registered = true
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false
        state.error = (action.payload as string) ?? 'Register failed'
        state.registered = false
      })
      .addCase(fetchMe.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.loading = false
        state.me = action.payload
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.loading = false
        // Do not clear token on transient errors; allow app to stay authenticated
        state.error = (action.payload as string) ?? 'Failed to load user'
      })
  },
})

export const { logout, clearAuthState } = slice.actions
export default slice.reducer
