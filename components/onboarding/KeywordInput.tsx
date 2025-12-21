"use client";

import { useState, useEffect } from 'react';
import { User, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { OnboardingFormData } from '@/types/onboarding';

interface KeywordInputProps {
  formData: OnboardingFormData;
  updateFormData: (data: Partial<OnboardingFormData>) => void;
}

export function KeywordInput({ formData, updateFormData }: KeywordInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (formData.name) {
      const nameParts = formData.name.toLowerCase().split(' ').filter(Boolean);
      const newSuggestions: string[] = [];

      if (nameParts.length > 1) {
        newSuggestions.push(nameParts.join(' '));
        newSuggestions.push([...nameParts].reverse().join(' '));
      }
      if (nameParts.length > 2) {
        newSuggestions.push(`${nameParts[0]} ${nameParts[nameParts.length - 1]}`);
      }

      setSuggestions([...new Set(newSuggestions)].filter(s => !formData.keywords?.includes(s)));
    } else {
      setSuggestions([]);
    }
  }, [formData.name, formData.keywords]);

  const addKeyword = (keyword: string) => {
    const newKeyword = keyword.trim();
    if (newKeyword && !(formData.keywords || []).includes(newKeyword)) {
      updateFormData({ keywords: [...(formData.keywords || []), newKeyword] });
    }
    setInputValue('');
  };

  const removeKeyword = (keywordToRemove: string) => {
    updateFormData({
      keywords: (formData.keywords || []).filter(keyword => keyword !== keywordToRemove),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(inputValue);
    }
  };

  return (
    <div className="group">
      <Label htmlFor="keywords" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <User className="w-4 h-4 text-violet-500" />
        Name Keywords
      </Label>
      <div className="mt-2 p-2 border-2 border-gray-200 rounded-xl focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-100 transition-all duration-200">
        <div className="flex flex-wrap gap-2 mb-2">
          {(formData.keywords || []).map(keyword => (
            <Badge key={keyword} variant="secondary" className="py-1 px-2 text-sm">
              {keyword}
              <button onClick={() => removeKeyword(keyword)} className="ml-2 rounded-full hover:bg-slate-300 p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Input
          id="keywords"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a keyword and press Enter..."
          className="border-none shadow-none focus-visible:ring-0 h-auto p-0"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1">Suggestions based on name:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(suggestion => (
              <Button key={suggestion} size="sm" variant="outline" onClick={() => addKeyword(suggestion)}>
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
