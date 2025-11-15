import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Activity, Search, Download, RefreshCw, Loader2, FileText, User, Calendar, AlertCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

type DateFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

interface ActivityLog {
  id: string;
  action: string;
  user_id: string;
  user_email?: string;
  details: any;
  created_at: string;
  user?: {
    full_name?: string;
    email?: string;
  };
}

export default function ActivityLogsView() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [users, setUsers] = useState<Array<{ id: string; email: string; full_name: string }>>([]);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    thisWeek: 0,
    thisMonth: 0
  });

  useEffect(() => {
    fetchLogs();
    fetchUsers();
  }, [dateFilter]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('full_name', { ascending: true });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    }
  };

  const getDateRange = () => {
    const now = new Date();
    
    switch (dateFilter) {
      case 'today':
        return {
          start: startOfDay(now),
          end: endOfDay(now)
        };
      case 'week':
        return {
          start: startOfWeek(now),
          end: endOfWeek(now)
        };
      case 'month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      case 'all':
        return {
          start: new Date('2000-01-01'),
          end: now
        };
      default:
        return {
          start: startOfDay(now),
          end: endOfDay(now)
        };
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const startStr = start.toISOString();
      const endStr = end.toISOString();

      // Fetch activity logs
      const { data: logsData, error: logsError } = await supabase
        .from('activity_logs')
        .select('*')
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) {
        console.error('Error fetching activity logs:', logsError);
        throw logsError;
      }

      // Get unique user IDs
      const userIds = [...new Set((logsData || []).map(log => log.user_id).filter(Boolean))];
      
      // Fetch all users at once
      let userMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        if (usersData) {
          userMap = usersData.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Enrich logs with user information
      const enrichedLogs = (logsData || []).map(log => ({
        ...log,
        user: log.user_id ? userMap[log.user_id] : null
      }));

      // Fetch stats for all time periods
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const weekStart = startOfWeek(now).toISOString();
      const monthStart = startOfMonth(now).toISOString();

      const [
        { count: todayCount },
        { count: weekCount },
        { count: monthCount },
        { count: totalCount }
      ] = await Promise.all([
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true })
      ]);

      setLogs(enrichedLogs || []);
      setStats({
        total: totalCount || 0,
        today: todayCount || 0,
        thisWeek: weekCount || 0,
        thisMonth: monthCount || 0
      });

    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('error') || action.includes('failed')) return 'destructive';
    if (action.includes('warn') || action.includes('warning')) return 'warning';
    if (action.includes('create') || action.includes('add') || action.includes('register')) return 'success';
    if (action.includes('update') || action.includes('edit')) return 'info';
    if (action.includes('delete') || action.includes('remove')) return 'destructive';
    if (action.includes('login') || action.includes('auth')) return 'outline';
    return 'secondary';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('patient')) return '👤';
    if (action.includes('appointment')) return '📅';
    if (action.includes('prescription')) return '💊';
    if (action.includes('lab')) return '🔬';
    if (action.includes('payment')) return '💰';
    if (action.includes('vitals')) return '❤️';
    if (action.includes('login') || action.includes('logout') || action.includes('auth')) return '🔐';
    if (action.includes('user.created') || action.includes('user.updated') || action.includes('user.deleted')) return '👥';
    return '📝';
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Action', 'User', 'Details'].join(','),
      ...filteredLogs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.action,
        log.user?.full_name || log.user_email || 'Unknown',
        JSON.stringify(log.details || {})
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_logs_${dateFilter}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Logs exported successfully');
  };

  const filteredLogs = logs.filter(log => {
    // Search filter
    const matchesSearch = searchQuery === '' || 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (log.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (typeof log.details === 'string' && log.details.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Action type filter
    const matchesAction = actionFilter === 'all' || log.action.includes(actionFilter);
    
    // User filter
    const matchesUser = userFilter === 'all' || log.user_id === userFilter;
    
    // Severity filter
    const getLogSeverity = (action: string) => {
      if (action.includes('error') || action.includes('failed')) return 'error';
      if (action.includes('warn') || action.includes('warning')) return 'warning';
      if (action.includes('create') || action.includes('add') || action.includes('register')) return 'success';
      if (action.includes('update') || action.includes('edit')) return 'info';
      if (action.includes('delete') || action.includes('remove')) return 'destructive';
      return 'info';
    };
    
    const matchesSeverity = severityFilter === 'all' || 
      getLogSeverity(log.action) === severityFilter;
    
    // Date range filter
    const logDate = new Date(log.created_at);
    const matchesDateRange = !dateRange.from || !dateRange.to || 
      (logDate >= dateRange.from && logDate <= dateRange.to);
    
    return matchesSearch && matchesAction && matchesUser && matchesSeverity && matchesDateRange;
  });

  const getFilterLabel = () => {
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
    }
    switch (dateFilter) {
      case 'today': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'all': return 'All Time';
      default: return 'Custom Range';
    }
  };

  const handleDateRangeSelect = (range: { from: Date | undefined; to: Date | undefined } | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range);
      setDateFilter('custom');
    } else if (range?.from) {
      setDateRange({ from: range.from, to: range.from });
      setDateFilter('custom');
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
            <p className="text-xs text-muted-foreground">Activities today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisWeek}</div>
            <p className="text-xs text-muted-foreground">Activities this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
            <p className="text-xs text-muted-foreground">Activities this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">All Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total activities</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity Logs
              </CardTitle>
              <CardDescription>
                Viewing {filteredLogs.length} activities for {getFilterLabel().toLowerCase()}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportLogs}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Controls */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={dateFilter} onValueChange={(value: DateFilter) => setDateFilter(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary hover:bg-primary/20">
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="h-6 border-0 p-0 text-xs font-semibold text-primary [&>span]:line-clamp-1 [&>span]:flex [&>span]:items-center [&>span]:gap-1">
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="patient">Patient Actions</SelectItem>
                    <SelectItem value="appointment">Appointments</SelectItem>
                    <SelectItem value="prescription">Prescriptions</SelectItem>
                    <SelectItem value="lab">Lab Tests</SelectItem>
                    <SelectItem value="payment">Payments</SelectItem>
                    <SelectItem value="vitals">Vitals</SelectItem>
                    <SelectItem value="login">Login/Logout</SelectItem>
                    <SelectItem value="logout">Logout</SelectItem>
                    <SelectItem value="user">User Management</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary hover:bg-primary/20">
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="h-6 border-0 p-0 text-xs font-semibold text-primary [&>span]:line-clamp-1 [&>span]:flex [&>span]:items-center [&>span]:gap-1">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <SelectValue placeholder="All Users" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary hover:bg-primary/20">
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="h-6 border-0 p-0 text-xs font-semibold text-primary [&>span]:line-clamp-1 [&>span]:flex [&>span]:items-center [&>span]:gap-1">
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      <SelectValue placeholder="All Severities" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer">
                    <Calendar className="mr-1 h-3 w-3" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <span>
                          {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                        </span>
                      ) : (
                        <span>{format(dateRange.from, "MMM d, y")}</span>
                      )
                    ) : (
                      <span>Date Range</span>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-2 px-2">
                      <h4 className="text-sm font-medium">Select Date Range</h4>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={() => {
                          setDateRange({ from: undefined, to: undefined });
                          setDateFilter('all');
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                    <CalendarComponent
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={handleDateRangeSelect}
                      numberOfMonths={2}
                      className="rounded-md border"
                    />
                    <div className="flex justify-between p-2 border-t">
                      <Button 
                        variant={dateFilter === 'today' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={() => {
                          setDateFilter('today');
                          setDateRange({
                            from: startOfDay(new Date()),
                            to: endOfDay(new Date())
                          });
                        }}
                      >
                        Today
                      </Button>
                      <Button 
                        variant={dateFilter === 'week' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={() => {
                          setDateFilter('week');
                          setDateRange({
                            from: startOfWeek(new Date()),
                            to: endOfWeek(new Date())
                          });
                        }}
                      >
                        This Week
                      </Button>
                      <Button 
                        variant={dateFilter === 'month' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={() => {
                          setDateFilter('month');
                          setDateRange({
                            from: startOfMonth(new Date()),
                            to: endOfMonth(new Date())
                          });
                        }}
                      >
                        This Month
                      </Button>
                      <Button 
                        variant={dateFilter === 'all' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={() => {
                          setDateFilter('all');
                          setDateRange({ from: undefined, to: undefined });
                        }}
                      >
                        All Time
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Logs Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No activity logs found</h3>
              <p className="text-muted-foreground">
                {searchQuery || actionFilter !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'Activity logs will appear here as users interact with the system'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="text-3xl flex-shrink-0 mt-1">
                      {getActionIcon(log.action)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <Badge variant={getActionBadgeVariant(log.action)} className="mb-2">
                            {log.action}
                          </Badge>
                          <div className="text-sm text-muted-foreground">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground">
                                {log.user?.full_name || 'Unknown User'}
                              </span>
                              <span className="text-xs">•</span>
                              <span>{format(new Date(log.created_at), 'MMM dd, yyyy')}</span>
                              <span className="text-xs">•</span>
                              <span>{format(new Date(log.created_at), 'HH:mm:ss')}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* View Details Button */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-shrink-0">
                              <FileText className="h-3 w-3 mr-1" />
                              View Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <span className="text-2xl">{getActionIcon(log.action)}</span>
                                Activity Details
                              </DialogTitle>
                              <DialogDescription>
                                {format(new Date(log.created_at), 'MMMM dd, yyyy HH:mm:ss')}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Action</Label>
                                  <div className="mt-1">
                                    <Badge variant={getActionBadgeVariant(log.action)}>
                                      {log.action}
                                    </Badge>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">User</Label>
                                  <div className="mt-1 font-medium">
                                    {log.user?.full_name || 'Unknown User'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {log.user?.email || log.user_email || 'No email'}
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <Label className="text-xs text-muted-foreground">Details (JSON)</Label>
                                <div className="mt-2 p-4 bg-slate-950 rounded-lg border border-slate-700 shadow-inner max-w-full overflow-hidden">
                                  {log.details ? (
                                    <pre className="text-xs max-h-96 font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                      <code 
                                        dangerouslySetInnerHTML={{
                                          __html: JSON.stringify(log.details, null, 2)
                                            .replace(/"([^"]+)":/g, '<span style="color: #60A5FA">"$1"</span>:') // Keys in blue
                                            .replace(/: "([^"]*)"/g, ': <span style="color: #34D399">"$1"</span>') // String values in green
                                            .replace(/: (\d+)/g, ': <span style="color: #F59E0B">$1</span>') // Numbers in orange
                                            .replace(/: (true|false)/g, ': <span style="color: #A78BFA">$1</span>') // Booleans in purple
                                            .replace(/: (null)/g, ': <span style="color: #EF4444">$1</span>') // Null in red
                                            .replace(/([{}[\],])/g, '<span style="color: #9CA3AF">$1</span>') // Brackets in gray
                                        }}
                                        style={{ color: '#E5E7EB' }}
                                      />
                                    </pre>
                                  ) : (
                                    <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                      <code 
                                        dangerouslySetInnerHTML={{
                                          __html: JSON.stringify({ message: "No details available" }, null, 2)
                                            .replace(/"([^"]+)":/g, '<span style="color: #60A5FA">"$1"</span>:')
                                            .replace(/: "([^"]*)"/g, ': <span style="color: #34D399">"$1"</span>')
                                        }}
                                        style={{ color: '#E5E7EB' }}
                                      />
                                    </pre>
                                  )}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
