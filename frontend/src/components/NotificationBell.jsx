import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconButton, Badge, Popover, List, ListItemButton, ListItemText,
  Typography, Box, Divider, Button,
} from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/notificationService';

export default function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await notificationService.getAll();
      return res.data;
    },
    refetchInterval: 30000,
  });

  const markAsRead = useMutation({
    mutationFn: (id) => notificationService.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleClick = (notification) => {
    if (!notification.isRead) {
      markAsRead.mutate(notification.id);
    }
    setAnchorEl(null);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxHeight: 480, borderRadius: 2 } }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight={600}>Notifications</Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={() => markAllRead.mutate()}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />
        {notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">No notifications</Typography>
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {notifications.slice(0, 10).map((notif) => (
              <ListItemButton
                key={notif.id}
                onClick={() => handleClick(notif)}
                sx={{
                  bgcolor: notif.isRead ? 'transparent' : 'action.hover',
                  borderBottom: 1, borderColor: 'divider',
                }}
              >
                <ListItemText
                  primary={notif.title}
                  secondary={notif.message}
                  primaryTypographyProps={{
                    fontWeight: notif.isRead ? 400 : 600,
                    variant: 'body2',
                  }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}
