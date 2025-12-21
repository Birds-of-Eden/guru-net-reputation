"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Client } from '@/types/client';

interface EditKeywordsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
  onKeywordsUpdate: (updatedClient: Client) => void;
}

export function EditKeywordsModal({ isOpen, onOpenChange, client, onKeywordsUpdate }: EditKeywordsModalProps) {
  const [keywords, setKeywords] = useState(client.keywords || []);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeywords(client.keywords || []);
    }
  }, [isOpen, client.keywords]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...client, keywords }),
      });

      if (!res.ok) {
        throw new Error('Failed to update keywords');
      }

      const updatedClient = await res.json();
      onKeywordsUpdate(updatedClient);
      toast.success('Keywords updated successfully');
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Name Keywords for {client.name}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={keywords.join(', ')}
            onChange={(e) =>
              setKeywords(
                e.target.value
                  .split(',')
                  .map((k) => k.trim())
                  .filter(Boolean)
              )
            }
            placeholder="Enter keywords, separated by commas"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
