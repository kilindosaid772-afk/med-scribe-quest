# HASET Logo Usage Guide

The HASET logo has been integrated throughout your hospital management system.

## Where the Logo Appears

### 1. Login/Auth Page
- Large logo with text on the login screen
- Centered at the top of the login card

### 2. Dashboard Header
- Small logo in the top-left corner of all dashboards
- Appears on every page (Admin, Doctor, Nurse, Receptionist, Lab, Pharmacy, Billing)

## Logo Component

The logo is available as a reusable React component: `<Logo />`

### Import
```tsx
import Logo from '@/components/Logo';
```

### Usage Examples

#### Small Logo (Header)
```tsx
<Logo size="sm" showText={false} />
```

#### Medium Logo with Text
```tsx
<Logo size="md" showText={true} />
```

#### Large Logo (Login Page)
```tsx
<Logo size="lg" showText={true} />
```

#### Extra Large Logo
```tsx
<Logo size="xl" showText={true} />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Size of the logo |
| `showText` | `boolean` | `true` | Show "HASET" text and subtitle |
| `className` | `string` | `''` | Additional CSS classes |

## Sizes

- **sm**: 32px (h-8 w-8) - Used in headers
- **md**: 48px (h-12 w-12) - Default size
- **lg**: 64px (h-16 w-16) - Used on login page
- **xl**: 96px (h-24 w-24) - For special displays

## Logo Design

The HASET logo features:
- **Green Medical Cross**: Represents healthcare
- **Red Curved Line**: Symbolizes life and vitality
- **Red ECG/Heartbeat Line**: Represents monitoring and care
- **Red Banner with "HASET"**: Brand name
- **Rounded Border**: Professional appearance

## Customization

### Change Logo Colors

Edit `src/components/Logo.tsx`:

```tsx
// Green colors
stroke="#2D7A5F"  // Border
fill="#1A5A42"    // Cross

// Red colors  
stroke="#EF4444"  // Lines
fill="#EF4444"    // Banner
```

### Add Logo to Other Pages

```tsx
import Logo from '@/components/Logo';

function MyComponent() {
  return (
    <div>
      <Logo size="md" showText={true} />
      {/* Your content */}
    </div>
  );
}
```

## Examples in Your Project

### Dashboard Header
```tsx
// src/components/DashboardLayout.tsx
<Logo size="sm" showText={false} />
```

### Login Page
```tsx
// src/pages/Auth.tsx
<Logo size="lg" showText={true} className="justify-center" />
```

### Custom Usage
```tsx
// Any component
<div className="flex items-center gap-4">
  <Logo size="md" showText={false} />
  <h1>My Custom Page</h1>
</div>
```

## Logo Files

The logo is implemented as an SVG component, which means:
- ✅ Scales perfectly at any size
- ✅ No image files needed
- ✅ Fast loading
- ✅ Easy to customize colors
- ✅ Works in all browsers

## Branding Guidelines

### Do's
- ✅ Use the logo at appropriate sizes
- ✅ Maintain aspect ratio
- ✅ Use on light backgrounds
- ✅ Keep adequate spacing around logo

### Don'ts
- ❌ Don't distort or stretch the logo
- ❌ Don't change the design elements
- ❌ Don't use on busy backgrounds
- ❌ Don't make it too small (minimum 24px)

## Support

If you need to modify the logo design, edit the SVG paths in `src/components/Logo.tsx`.

---

**Last Updated:** November 15, 2025
