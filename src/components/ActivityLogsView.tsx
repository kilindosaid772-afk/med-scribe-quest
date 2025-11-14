import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Activity, Search, Download, RefreshCw, Loader2, FileText } from 'lucide-react';

type DateFilter = 'today' | 'week' | 'month' | 'all';

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
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    thisWeek: 0,
    thisMonth: 0
  });

  useEffect(() => {
    fetchLogs();
  }, [dateFilter]);

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
        .select(`
          *,
          user:profiles(full_name, email)
        `)
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

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

      setLogs(logsData || []);
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
    if (action.includes('create') || action.includes('add') || action.includes('register')) return 'default';
    if (action.includes('update') || action.includes('edit')) return 'secondary';
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
    if (action.includes('login') || action.includes('auth')) return '🔐';
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
    const matchesSearch = searchQuery === '' || 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action.includes(actionFilter);
    
    return matchesSearch && matchesAction;
  });

  const getFilterLabel = () => {
    switch (dateFilter) {
      case 'today': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'all': return 'All Time';
      default: return 'Today';
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
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="patient">Patient Actions</SelectItem>
                <SelectItem value="appointment">Appointments</SelectItem>
                <SelectItem value="prescription">Prescriptions</SelectItem>
                <SelectItem value="lab">Lab Tests</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
                <SelectItem value="auth">Authentication</SelectItem>
              </SelectContent>
            </Select>
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
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-2xl">{getActionIcon(log.action)}</TableCell>
                      <TableCell className="text-sm">
                        <div>{format(new Date(log.created_at), 'MMM dd, yyyy')}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'HH:mm:ss')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {log.user?.full_name || 'Unknown User'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.user?.email || log.user_email || 'No email'}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="text-sm text-muted-foreground truncate">
                          {log.details ? (
                            typeof log.details === 'string' 
                              ? log.details 
                              : JSON.stringify(log.details).substring(0, 100)
                          ) : 'No details'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
