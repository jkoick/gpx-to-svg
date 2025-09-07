'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PaletteIcon } from 'lucide-react';

interface SimpleColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}

const PRESET_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#AED6F1', '#D7DBDD',
  '#2C3E50', '#34495E', '#7F8C8D', '#BDC3C7', '#ECF0F1'
];

export function SimpleColorPicker({ value, onChange, label, disabled }: SimpleColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-8 h-8 p-0 border-2"
            style={{ backgroundColor: value }}
            disabled={disabled}
          >
            <span className="sr-only">Pick color</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-12 h-8 p-0 border cursor-pointer"
              />
              <Input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="text-sm font-mono"
                placeholder="#000000"
              />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className="w-8 h-8 rounded border-2 border-gray-200 hover:border-gray-400 transition-colors"
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    onChange(color);
                    setIsOpen(false);
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}