import { forwardRef } from 'react';
import { HugeiconsIcon, HugeiconsProps, IconSvgElement } from '@hugeicons/react';
import * as CoreIcons from '@hugeicons/core-free-icons';

export interface IconProps extends Omit<HugeiconsProps, 'icon'> {
  className?: string;
  size?: number | string;
  color?: string;
  strokeWidth?: number;
}

export const createIcon = (iconData: IconSvgElement, displayName: string) => {
  const IconComponent = forwardRef<SVGSVGElement, IconProps>((props, ref) => (
    <HugeiconsIcon
      ref={ref}
      icon={iconData}
      size={props.size ?? 24}
      color={props.color ?? 'currentColor'}
      strokeWidth={props.strokeWidth}
      {...props}
    />
  ));
  IconComponent.displayName = displayName;
  return IconComponent;
};

export { HugeiconsIcon };
export type { IconSvgElement, HugeiconsProps };

// 82 iconos Hugeicons para la suite Pautello
export const Activity = createIcon(CoreIcons.Activity01Icon, 'Activity');
export const AlertCircle = createIcon(CoreIcons.AlertCircleIcon, 'AlertCircle');
export const AlertOctagon = createIcon(CoreIcons.Alert01Icon, 'AlertOctagon');
export const AlertTriangle = createIcon(CoreIcons.Alert01Icon, 'AlertTriangle');
export const ArrowDown = createIcon(CoreIcons.ArrowDown01Icon, 'ArrowDown');
export const ArrowUp = createIcon(CoreIcons.ArrowUp01Icon, 'ArrowUp');
export const AudioWaveform = createIcon(CoreIcons.AudioWave01Icon, 'AudioWaveform');
export const Award = createIcon(CoreIcons.Award01Icon, 'Award');
export const BookOpen = createIcon(CoreIcons.BookOpen01Icon, 'BookOpen');
export const Boxes = createIcon(CoreIcons.Package01Icon, 'Boxes');
export const Cable = createIcon(CoreIcons.UsbIcon, 'Cable');
export const Check = createIcon(CoreIcons.Tick01Icon, 'Check');
export const CheckCircle2 = createIcon(CoreIcons.CheckmarkCircle01Icon, 'CheckCircle2');
export const ChevronDown = createIcon(CoreIcons.ArrowDown01Icon, 'ChevronDown');
export const ChevronLeft = createIcon(CoreIcons.ArrowLeft01Icon, 'ChevronLeft');
export const ChevronRight = createIcon(CoreIcons.ArrowRight01Icon, 'ChevronRight');
export const ChevronUp = createIcon(CoreIcons.ArrowUp01Icon, 'ChevronUp');
export const Clipboard = createIcon(CoreIcons.ClipboardIcon, 'Clipboard');
export const Clock = createIcon(CoreIcons.Clock01Icon, 'Clock');
export const Coffee = createIcon(CoreIcons.Coffee01Icon, 'Coffee');
export const Copy = createIcon(CoreIcons.Copy01Icon, 'Copy');
export const Download = createIcon(CoreIcons.Download01Icon, 'Download');
export const Edit2 = createIcon(CoreIcons.Edit02Icon, 'Edit2');
export const FileCode2 = createIcon(CoreIcons.FileCodeIcon, 'FileCode2');
export const FileJson2 = createIcon(CoreIcons.FileCodeIcon, 'FileJson2');
export const FileMusic = createIcon(CoreIcons.FileMusicIcon, 'FileMusic');
export const FilePlus = createIcon(CoreIcons.FileAddIcon, 'FilePlus');
export const FileStack = createIcon(CoreIcons.Files01Icon, 'FileStack');
export const FileText = createIcon(CoreIcons.FileAttachmentIcon, 'FileText');
export const Flame = createIcon(CoreIcons.FireIcon, 'Flame');
export const FolderOpen = createIcon(CoreIcons.FolderOpenIcon, 'FolderOpen');
export const Gauge = createIcon(CoreIcons.DashboardSpeedIcon, 'Gauge');
export const Globe = createIcon(CoreIcons.GlobeIcon, 'Globe');
export const GraduationCap = createIcon(CoreIcons.Mortarboard01Icon, 'GraduationCap');
export const Headphones = createIcon(CoreIcons.HeadphonesIcon, 'Headphones');
export const Heart = createIcon(CoreIcons.FavouriteIcon, 'Heart');
export const HelpCircle = createIcon(CoreIcons.HelpCircleIcon, 'HelpCircle');
export const Info = createIcon(CoreIcons.InformationCircleIcon, 'Info');
export const Image = createIcon(CoreIcons.Image01Icon, 'Image');
export const Keyboard = createIcon(CoreIcons.KeyboardIcon, 'Keyboard');
export const Layers = createIcon(CoreIcons.Layers01Icon, 'Layers');
export const LayoutGrid = createIcon(CoreIcons.LayoutGridIcon, 'LayoutGrid');
export const Lightbulb = createIcon(CoreIcons.BulbIcon, 'Lightbulb');
export const Loader2 = createIcon(CoreIcons.Loading02Icon, 'Loader2');
export const Menu = createIcon(CoreIcons.Menu01Icon, 'Menu');
export const MessageCircle = createIcon(CoreIcons.MessageCircleIcon, 'MessageCircle');
export const Mic = createIcon(CoreIcons.Mic01Icon, 'Mic');
export const MicOff = createIcon(CoreIcons.MicOff01Icon, 'MicOff');
export const Minus = createIcon(CoreIcons.MinusSignIcon, 'Minus');
export const Moon = createIcon(CoreIcons.MoonIcon, 'Moon');
export const Music = createIcon(CoreIcons.MusicNote01Icon, 'Music');
export const Music2 = createIcon(CoreIcons.MusicNote02Icon, 'Music2');
export const PanelRightClose = createIcon(CoreIcons.PanelRightCloseIcon, 'PanelRightClose');
export const PanelRightOpen = createIcon(CoreIcons.PanelRightOpenIcon, 'PanelRightOpen');
export const Pause = createIcon(CoreIcons.PauseIcon, 'Pause');
export const Piano = createIcon(CoreIcons.MusicNote01Icon, 'Piano');
export const Play = createIcon(CoreIcons.PlayIcon, 'Play');
export const Plus = createIcon(CoreIcons.Add01Icon, 'Plus');
export const Printer = createIcon(CoreIcons.PrinterIcon, 'Printer');
export const Redo = createIcon(CoreIcons.RedoIcon, 'Redo');
export const Repeat = createIcon(CoreIcons.RepeatIcon, 'Repeat');
export const RotateCcw = createIcon(CoreIcons.RotateLeft01Icon, 'RotateCcw');
export const ScrollText = createIcon(CoreIcons.ScrollIcon, 'ScrollText');
export const Search = createIcon(CoreIcons.Search01Icon, 'Search');
export const Send = createIcon(CoreIcons.SentIcon, 'Send');
export const Settings = createIcon(CoreIcons.Settings01Icon, 'Settings');
export const Share2 = createIcon(CoreIcons.Share02Icon, 'Share2');
export const Sliders = createIcon(CoreIcons.SlidersHorizontalIcon, 'Sliders');
export const SlidersHorizontal = createIcon(CoreIcons.SlidersHorizontalIcon, 'SlidersHorizontal');
export const Sparkles = createIcon(CoreIcons.SparklesIcon, 'Sparkles');
export const Square = createIcon(CoreIcons.SquareIcon, 'Square');
export const Sun = createIcon(CoreIcons.Sun01Icon, 'Sun');
export const Target = createIcon(CoreIcons.Target01Icon, 'Target');
export const Trash2 = createIcon(CoreIcons.Delete02Icon, 'Trash2');
export const Type = createIcon(CoreIcons.TextIcon, 'Type');
export const Undo = createIcon(CoreIcons.UndoIcon, 'Undo');
export const Upload = createIcon(CoreIcons.Upload01Icon, 'Upload');
export const UploadCloud = createIcon(CoreIcons.CloudUploadIcon, 'UploadCloud');
export const Volume2 = createIcon(CoreIcons.Volume02Icon, 'Volume2');
export const VolumeX = createIcon(CoreIcons.VolumeMute01Icon, 'VolumeX');
export const Wind = createIcon(CoreIcons.WindIcon, 'Wind');
export const Wrench = createIcon(CoreIcons.Wrench01Icon, 'Wrench');
export const X = createIcon(CoreIcons.Cancel01Icon, 'X');
