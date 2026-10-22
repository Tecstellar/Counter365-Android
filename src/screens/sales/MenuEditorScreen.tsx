import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
  Modal,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { AppButton } from '../../components/common/AppButton';
import { AppTag } from '../../components/common/AppTag';
import { CategoryActionMenuModal } from '../../components/modals/CategoryActionMenuModal';
import { useShop } from '../../context/ShopContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { menuService } from '../../services/menuService';
import { geminiMenuScanner, ScannedMenuItem } from '../../services/geminiMenuScanner';
import { geminiImageService } from '../../services/geminiImageService';
import { generatePhotorealisticFoodPrompt } from '../../services/geminiImagePromptGenerator';
import { imageStorageService } from '../../services/imageStorageService';
import { getDishFoodIcon } from '../../constants/dishIcons';
import { DishVectorIcon } from '../../components/common/DishVectorIcon';
import { AVAILABLE_PHOSPHOR_ICONS } from '../../constants/phosphorDishIcons';
import { MenuItem, MenuCategory } from '../../types/models';
import { formatRupee } from '../../lib/money';
import { generateUUID, isValidUUID } from '../../lib/uuid';
import { supabase } from '../../lib/supabase';

interface MenuEditorScreenProps {
  onBackToMenu: () => void;
  openCreateCategoryImmediately?: boolean;
  openCreateItemImmediately?: boolean;
}

export const MenuEditorScreen: React.FC<MenuEditorScreenProps> = ({
  onBackToMenu,
  openCreateCategoryImmediately = false,
  openCreateItemImmediately = false,
}) => {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { shop } = useShop();
  const { flash } = useCart();
  const { can } = useAuth();
  const { t } = useLanguage();

  // Immediate override protection: If owner revokes menu edit permission while menu editor is open
  useEffect(() => {
    if (!can('menu')) {
      flash(t('no_access', "You don't have access for that"));
      onBackToMenu();
    }
  }, [can]);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(openCreateCategoryImmediately);
  const [categoryNameInput, setCategoryNameInput] = useState('');

  const [editingItem, setEditingItem] = useState<MenuItem | null>(
    openCreateItemImmediately
      ? {
          id: `item_${Date.now()}`,
          shopId: shop.id,
          categoryId: '',
          name: '',
          price: 0,
          halfPrice: 0,
          hasHalf: false,
          isFavorite: false,
          isAvailable: true,
          sortOrder: 0,
        }
      : null
  );

  const [itemNameInput, setItemNameInput] = useState('');
  const [fullPriceInput, setFullPriceInput] = useState('');
  const [halfPriceInput, setHalfPriceInput] = useState('');
  const fullPriceInputRef = useRef<TextInput>(null);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [isFav, setIsFav] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [itemPhotoUrl, setItemPhotoUrl] = useState<string | null>(null);
  const [selectedIconKey, setSelectedIconKey] = useState<string | null>(null);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Gemini AI Menu Import States (Horizontal Progress Bar)
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [isScanningMenu, setIsScanningMenu] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStageText, setScanStageText] = useState('Initializing scan...');
  const [scannedItems, setScannedItems] = useState<ScannedMenuItem[]>([]);
  const [showScannedPreview, setShowScannedPreview] = useState(false);
  const [isSavingScanned, setIsSavingScanned] = useState(false);
  const [isGeneratingAiPhoto, setIsGeneratingAiPhoto] = useState(false);
  const [isGeneratingBatchImages, setIsGeneratingBatchImages] = useState(false);
  const [batchImageProgress, setBatchImageProgress] = useState({ done: 0, total: 0 });

  // Category filter and category editing states
  const [selectedFilterCatId, setSelectedFilterCatId] = useState<string>('all');
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editCategoryNameInput, setEditCategoryNameInput] = useState('');
  const [selectedCategoryForMenu, setSelectedCategoryForMenu] = useState<MenuCategory | null>(null);
  const [isCategoryMenuVisible, setIsCategoryMenuVisible] = useState(false);

  // Multi-select / Bulk Delete State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // 3-Dot Header Menu & Bulk Price Edit State
  const [showHeaderActionsModal, setShowHeaderActionsModal] = useState(false);
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [bulkEditMap, setBulkEditMap] = useState<Record<string, { price: number; halfPrice: number }>>({});
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  // Import Strategy Modal (Replace vs Add to Existing)
  const [showImportStrategyModal, setShowImportStrategyModal] = useState(false);

  useEffect(() => {
    loadMenu();

    if (!shop.id) return;
    const channel = supabase
      .channel(`editor-menu-sync-${shop.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_categories', filter: `shop_id=eq.${shop.id}` },
        () => {
          loadMenu();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items', filter: `shop_id=eq.${shop.id}` },
        () => {
          loadMenu();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shop.id]);

  const loadMenu = async () => {
    const cats = await menuService.getCategories(shop.id, shop.shopType);
    const menuItems = await menuService.getMenuItems(shop.id, shop.shopType);
    setCategories(cats);
    setItems(menuItems);
    if (!selectedCatId && cats.length > 0) {
      setSelectedCatId(cats[0].id);
    }
  };

  // Always sort favorite dishes to the very top of the list
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      // 1. Favorites always first at top
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      // 2. Sort order
      if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      }
      // 3. Alphabetical fallback
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  const handleToggleFavorite = async (itemId: string) => {
    try {
      const updated = await menuService.toggleFavorite(itemId);
      setItems(updated);
      const target = updated.find(i => i.id === itemId);
      flash(target?.isFavorite ? `"${target.name}" marked as Favourite ❤️ (listed at top)` : `"${target?.name}" removed from Favourites`);
    } catch (err) {
      flash('Failed to update favourite');
    }
  };

  const handleStartEdit = (item: MenuItem) => {
    setEditingItem(item);
    setItemNameInput(item.name);
    setFullPriceInput(String(item.price));
    setHalfPriceInput(item.halfPrice ? String(item.halfPrice) : '');
    setSelectedCatId(item.categoryId);
    setIsFav(item.isFavorite);
    setIsAvailable(item.isAvailable);
    setItemPhotoUrl(item.imageUrl || null);
    setSelectedIconKey(item.icon || null);

    // Auto-focus directly into the price field as requested
    setTimeout(() => {
      fullPriceInputRef.current?.focus();
    }, 120);
  };

  const handleStartNewItem = () => {
    Keyboard.dismiss();
    const validCat = categories.find(c => isValidUUID(c.id));
    const defaultCat = validCat ? validCat.id : (categories[0]?.id || '');
    setEditingItem({
      id: generateUUID(),
      shopId: shop.id,
      categoryId: defaultCat,
      name: '',
      price: 0,
      halfPrice: 0,
      hasHalf: false,
      isFavorite: false,
      isAvailable: true,
      sortOrder: items.length,
    });
    setItemNameInput('');
    setFullPriceInput('');
    setHalfPriceInput('');
    setSelectedCatId(defaultCat);
    setIsFav(false);
    setIsAvailable(true);
    setItemPhotoUrl(null);
    setSelectedIconKey(null);
  };

  useEffect(() => {
    if (openCreateItemImmediately) {
      handleStartNewItem();
    }
  }, [openCreateItemImmediately]);

  const handlePickItemPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        flash('Gallery permission is needed to choose a dish photo');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setItemPhotoUrl(uri);
        flash('Dish photo updated');
      }
    } catch (err) {
      flash('Could not load image');
    }
  };

  const handleGenerateAiPhoto = async () => {
    const name = (itemNameInput || editingItem?.name || '').trim();
    if (!name) {
      flash('Enter dish name first');
      return;
    }
    setIsGeneratingAiPhoto(true);
    try {
      const catName = categories.find(c => c.id === selectedCatId)?.name || 'General';
      const prompt = generatePhotorealisticFoodPrompt(name, catName);
      const res = await geminiImageService.generateFoodImage(prompt);
      if (res.success && res.base64Data) {
        const savedUrl = await imageStorageService.persistFoodImage(
          shop.id,
          `dish_${name.replace(/\s+/g, '_').toLowerCase()}`,
          res.base64Data,
          res.mimeType || 'image/jpeg'
        );
        setItemPhotoUrl(savedUrl);
        flash('Generated photorealistic food image!');
      } else {
        flash('AI photo generation note: ' + (res.error || 'Quota/Network limit'));
      }
    } catch (err: any) {
      flash('AI photo generation failed: ' + err.message);
    } finally {
      setIsGeneratingAiPhoto(false);
    }
  };

  const handleStartBatchImageGeneration = async (itemsToProcess?: ScannedMenuItem[]) => {
    const targetItems = itemsToProcess || scannedItems;
    if (targetItems.length === 0 || isGeneratingBatchImages) return;

    setIsGeneratingBatchImages(true);
    setBatchImageProgress({ done: 0, total: targetItems.filter(it => it.selected).length });

    try {
      await geminiMenuScanner.generateImagesBatch(
        shop.id,
        targetItems,
        (done, total, updatedItem) => {
          setBatchImageProgress({ done, total });
          setScannedItems(prev =>
            prev.map(p => (p.name.toLowerCase() === updatedItem.name.toLowerCase() ? updatedItem : p))
          );
        }
      );
    } catch (err: any) {
      console.warn('Batch image generation notice:', err?.message);
    } finally {
      setIsGeneratingBatchImages(false);
    }
  };

  const handleSaveItem = async () => {
    Keyboard.dismiss();
    if (!can('menu')) {
      flash(t('no_access', "You don't have access for that"));
      return;
    }
    const cleanName = itemNameInput.trim();
    const cleanPriceStr = fullPriceInput.trim();

    if (!cleanName) {
      flash('Name is required');
      return;
    }

    const full = cleanPriceStr ? Number(cleanPriceStr.replace(/[^0-9]/g, '')) : 0;
    if (isNaN(full) || full < 0) {
      flash('Please enter a valid price');
      return;
    }

    const half = Number(halfPriceInput.replace(/[^0-9]/g, ''));

    setIsSavingItem(true);
    try {
      // Find a valid UUID category
      let catId = selectedCatId;
      if (!catId || !isValidUUID(catId)) {
        const existingValidCat = categories.find(c => isValidUUID(c.id));
        if (existingValidCat) {
          catId = existingValidCat.id;
        } else {
          // If no categories exist, create default
          const newCat = await menuService.addCategory(shop.id, 'General');
          setCategories(prev => [...prev, newCat]);
          catId = newCat.id;
        }
      }

      const itemId =
        editingItem?.id && isValidUUID(editingItem.id)
          ? editingItem.id
          : generateUUID();

      const finalImageUrl = itemPhotoUrl || null;
      const catName = categories.find(c => c.id === catId)?.name || 'General';
      const resolvedPrompt =
        editingItem?.imagePrompt ||
        generatePhotorealisticFoodPrompt(cleanName, catName);

      const itemRecord: MenuItem = {
        id: itemId,
        shopId: shop.id,
        categoryId: catId,
        name: cleanName,
        price: full,
        halfPrice: half > 0 ? half : undefined,
        hasHalf: half > 0,
        isFavorite: isFav,
        isAvailable: isAvailable,
        imageUrl: finalImageUrl,
        imagePrompt: resolvedPrompt,
        imageStatus: finalImageUrl ? 'completed' : (editingItem?.imageStatus || null),
        sortOrder: editingItem?.sortOrder ?? items.length,
        icon: selectedIconKey || null,
      };

      const updated = await menuService.saveMenuItem(itemRecord);
      setItems(updated);
      setEditingItem(null);
      setItemNameInput('');
      setFullPriceInput('');
      setHalfPriceInput('');
      setItemPhotoUrl(null);
      setSelectedIconKey(null);
      flash(`${itemRecord.name} saved`);
    } catch (err: any) {
      console.error('handleSaveItem error:', err);
      flash('Failed to save item: ' + (err?.message || 'Please check fields'));
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleSaveCategory = async () => {
    Keyboard.dismiss();
    if (!can('menu')) {
      flash(t('no_access', "You don't have access for that"));
      return;
    }
    const name = categoryNameInput.trim();
    if (!name) {
      flash('Give the category a name');
      return;
    }

    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      flash(`${name} already exists — use Add item`);
      return;
    }

    setIsSavingCategory(true);
    try {
      const newCat = await menuService.addCategory(shop.id, name);
      setCategories(prev => [...prev, newCat]);
      setIsCreatingCategory(false);
      setCategoryNameInput('');
      flash(`${name} created — add its first item`);

      setItemNameInput('');
      setFullPriceInput('');
      setHalfPriceInput('');
      setItemPhotoUrl(null);
      setIsFav(false);
      setIsAvailable(true);
      setSelectedCatId(newCat.id);

      setEditingItem({
        id: generateUUID(),
        shopId: shop.id,
        categoryId: newCat.id,
        name: '',
        price: 0,
        halfPrice: 0,
        hasHalf: false,
        isFavorite: false,
        isAvailable: true,
        sortOrder: items.length,
      });
    } catch (err: any) {
      console.error('handleSaveCategory error:', err);
      flash('Failed to create category: ' + (err?.message || 'Please try again'));
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteItem = (itemId: string, itemName: string) => {
    if (!can('menu')) {
      flash(t('no_access', "You don't have access for that"));
      return;
    }
    Alert.alert(
      'Delete Dish',
      `Are you sure you want to delete "${itemName}"? This dish will be permanently deleted from the database.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await menuService.deleteMenuItem(shop.id, itemId);
              setItems(updated);
              if (editingItem?.id === itemId) {
                setEditingItem(null);
              }
              flash(`"${itemName}" deleted from menu`);
            } catch (err) {
              flash('Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const handleStartEditCategory = (cat: MenuCategory) => {
    if (!can('menu')) {
      flash(t('no_access', "You don't have access for that"));
      return;
    }
    setEditingCategory(cat);
    setEditCategoryNameInput(cat.name);
  };

  const handleUpdateCategory = async () => {
    if (!can('menu')) {
      flash(t('no_access', "You don't have access for that"));
      return;
    }
    if (!editingCategory) return;
    const clean = editCategoryNameInput.trim();
    if (!clean) {
      flash('Enter category name');
      return;
    }
    try {
      const updatedCats = await menuService.updateCategory(shop.id, editingCategory.id, clean);
      setCategories(updatedCats);
      setEditingCategory(null);
      flash(`Category renamed to "${clean}"`);
    } catch (err) {
      flash('Failed to update category');
    }
  };

  const handleDeleteCategory = (cat: MenuCategory) => {
    if (!can('menu')) {
      flash(t('no_access', "You don't have access for that"));
      return;
    }
    const count = items.filter(i => i.categoryId === cat.id).length;
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${cat.name}"? All dishes in this category will also be deleted from the database.${count > 0 ? ` (${count} ${count === 1 ? 'dish' : 'dishes'} will be deleted)` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Category',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await menuService.deleteCategory(shop.id, cat.id);
              setCategories(res.categories);
              setItems(res.items);
              if (selectedCatId === cat.id) {
                setSelectedCatId(res.categories[0]?.id || '');
              }
              if (selectedFilterCatId === cat.id) {
                setSelectedFilterCatId('all');
              }
              setEditingCategory(null);
              flash(`Category "${cat.name}" deleted`);
            } catch (err) {
              flash('Failed to delete category');
            }
          },
        },
      ]
    );
  };

  // Import from Menu (Gemini AI Scanner with HORIZONTAL Percentage Bar)
  const handleScanMenuFromSource = async (source: 'camera' | 'gallery') => {
    setShowImportOptions(false);
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          flash('Camera permission is required to photograph your menu card');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.45,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          flash('Gallery permission is required to select your menu image');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.45,
          base64: true,
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        flash('Could not read image file');
        return;
      }

      // Start Horizontal Loading Bar Progress
      setIsScanningMenu(true);
      setScanProgress(8);
      setScanStageText('Reading menu photo... (8%)');

      let currentProgress = 8;
      const progressTimer = setInterval(() => {
        if (currentProgress < 28) {
          currentProgress += 3.2;
          setScanStageText(`Reading menu image... (${Math.round(currentProgress)}%)`);
        } else if (currentProgress < 60) {
          currentProgress += 1.8;
          setScanStageText(`Counter365 AI analyzing text & prices... (${Math.round(currentProgress)}%)`);
        } else if (currentProgress < 85) {
          currentProgress += 1.1;
          setScanStageText(`Matching authentic dish photos... (${Math.round(currentProgress)}%)`);
        } else if (currentProgress < 94) {
          currentProgress += 0.4;
          setScanStageText(`Structuring menu catalog... (${Math.round(currentProgress)}%)`);
        }
        setScanProgress(Math.min(94, currentProgress));
      }, 90);

      const scanRes = await geminiMenuScanner.scanMenuCard(
        asset.base64,
        asset.mimeType || 'image/jpeg'
      );

      clearInterval(progressTimer);

      if (scanRes.success && scanRes.items.length > 0) {
        // Accelerate smoothly to 100%
        setScanProgress(98);
        setScanStageText('Finalizing menu dishes... (98%)');
        await new Promise(r => setTimeout(r, 200));
        setScanProgress(100);
        setScanStageText('Menu extracted successfully! (100%)');
        await new Promise(r => setTimeout(r, 450));

        setIsScanningMenu(false);
        const extractedItems = scanRes.items.map(it => ({ ...it, selected: true }));
        setScannedItems(extractedItems);
        setShowScannedPreview(true);
      } else {
        setIsScanningMenu(false);
        flash(scanRes.error || 'No menu items could be identified. Please try a clearer photo.');
      }
    } catch (err: any) {
      setIsScanningMenu(false);
      flash('Menu scan failed: ' + (err?.message || 'Network error'));
    }
  };

  const handleToggleScannedItem = (index: number) => {
    setScannedItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], selected: !copy[index].selected };
      return copy;
    });
  };

  const handleToggleSelectAllScanned = () => {
    const hasUnchecked = scannedItems.some(it => !it.selected);
    setScannedItems(prev => prev.map(it => ({ ...it, selected: hasUnchecked })));
  };

  const handleInitiateImportScannedItems = () => {
    const selected = scannedItems.filter(it => it.selected);
    if (selected.length === 0) {
      flash('Select at least one item to add');
      return;
    }

    if (items.length > 0) {
      setShowImportStrategyModal(true);
    } else {
      handleConfirmImportScannedItems('add');
    }
  };

  const handleConfirmImportScannedItems = async (strategy: 'add' | 'replace') => {
    setShowImportStrategyModal(false);
    const selected = scannedItems.filter(it => it.selected);
    if (selected.length === 0) {
      flash('Select at least one item to add');
      return;
    }

    setIsSavingScanned(true);
    try {
      if (strategy === 'replace') {
        await menuService.replaceEntireMenu(shop.id, selected);
        flash(`Replaced entire menu with ${selected.length} items!`);
      } else {
        await menuService.batchAddMenuItems(shop.id, selected);
        flash(`Added ${selected.length} items to your menu!`);
      }
      const updatedCats = await menuService.getCategories(shop.id, shop.shopType);
      const updatedItems = await menuService.getMenuItems(shop.id, shop.shopType);
      setCategories(updatedCats);
      setItems(updatedItems);
      setShowScannedPreview(false);
    } catch (err: any) {
      console.warn('Batch add notice:', err);
      flash('Could not add items. Please try again.');
    } finally {
      setIsSavingScanned(false);
    }
  };

  const handleToggleSelectMode = () => {
    if (isSelectMode) {
      setIsSelectMode(false);
      setSelectedItemIds(new Set());
    } else {
      setIsSelectMode(true);
      setIsBulkEditMode(false);
      setSelectedItemIds(new Set());
    }
  };

  const handleStartBulkEdit = () => {
    if (!can('menu')) {
      flash(t('no_access', "You don't have access for that"));
      return;
    }
    const initialMap: Record<string, { price: number; halfPrice: number }> = {};
    items.forEach(i => {
      initialMap[i.id] = {
        price: i.price,
        halfPrice: i.halfPrice || 0,
      };
    });
    setBulkEditMap(initialMap);
    setIsBulkEditMode(true);
    setIsSelectMode(false);
    setSelectedItemIds(new Set());
  };

  const handleCancelBulkEdit = () => {
    setIsBulkEditMode(false);
    setBulkEditMap({});
  };

  const handleStepPrice = (itemId: string, field: 'price' | 'halfPrice', delta: number) => {
    setBulkEditMap(prev => {
      const item = items.find(i => i.id === itemId);
      const current = prev[itemId] || {
        price: item?.price || 0,
        halfPrice: item?.halfPrice || 0,
      };
      const oldVal = current[field];
      const nextVal = Math.max(0, oldVal + delta);
      return {
        ...prev,
        [itemId]: {
          ...current,
          [field]: nextVal,
        },
      };
    });
  };

  const handleDirectPriceChange = (itemId: string, field: 'price' | 'halfPrice', text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const num = cleaned ? parseInt(cleaned, 10) : 0;
    setBulkEditMap(prev => {
      const item = items.find(i => i.id === itemId);
      const current = prev[itemId] || {
        price: item?.price || 0,
        halfPrice: item?.halfPrice || 0,
      };
      return {
        ...prev,
        [itemId]: {
          ...current,
          [field]: num,
        },
      };
    });
  };

  const handleSaveBulkEdits = async () => {
    if (!can('menu')) {
      flash(t('no_access', "You don't have access for that"));
      return;
    }
    Keyboard.dismiss();
    setIsSavingBulk(true);
    try {
      const modifiedItems: MenuItem[] = [];
      items.forEach(item => {
        const edited = bulkEditMap[item.id];
        if (edited && (edited.price !== item.price || edited.halfPrice !== (item.halfPrice || 0))) {
          modifiedItems.push({
            ...item,
            price: edited.price,
            halfPrice: edited.halfPrice > 0 ? edited.halfPrice : undefined,
            hasHalf: item.hasHalf || edited.halfPrice > 0,
          });
        }
      });

      if (modifiedItems.length === 0) {
        setIsBulkEditMode(false);
        setBulkEditMap({});
        flash('No price changes to save');
        return;
      }

      const updated = await menuService.batchUpdateMenuItems(shop.id, modifiedItems);
      setItems(updated);
      setIsBulkEditMode(false);
      setBulkEditMap({});
      flash(`Saved prices for ${modifiedItems.length} ${modifiedItems.length === 1 ? 'dish' : 'dishes'}!`);
    } catch (err: any) {
      console.error('handleSaveBulkEdits error:', err);
      flash('Failed to save prices: ' + (err?.message || 'Please try again'));
    } finally {
      setIsSavingBulk(false);
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisibleItems = (visibleList: MenuItem[]) => {
    if (selectedItemIds.size === visibleList.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(visibleList.map(i => i.id)));
    }
  };

  const handleDeleteSelectedItems = () => {
    const count = selectedItemIds.size;
    if (count === 0) {
      flash('Please select items to delete');
      return;
    }

    Alert.alert(
      'Delete Selected Dishes',
      `Are you sure you want to delete ${count} selected ${count === 1 ? 'dish' : 'dishes'}? All selected dishes will be permanently deleted from the database.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete (${count})`,
          style: 'destructive',
          onPress: async () => {
            setIsDeletingBatch(true);
            try {
              const updated = await menuService.deleteMenuItemsBatch(shop.id, Array.from(selectedItemIds));
              setItems(updated);
              setSelectedItemIds(new Set());
              setIsSelectMode(false);
              flash(`Deleted ${count} ${count === 1 ? 'item' : 'items'} from menu`);
            } catch (err) {
              flash('Failed to delete items');
            } finally {
              setIsDeletingBatch(false);
            }
          },
        },
      ]
    );
  };

  const catSuggestions = ['Milkshakes', 'Combos', 'Sweets', 'Breakfast'].filter(
    c => !categories.some(cat => cat.name.toLowerCase() === c.toLowerCase())
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBackToMenu} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Menu Management</Text>
          <View style={styles.headerRightGroup}>
            {isBulkEditMode ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  onPress={handleCancelBulkEdit}
                  style={styles.headerCancelEditBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.headerCancelEditText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveBulkEdits}
                  disabled={isSavingBulk}
                  style={styles.headerSaveEditBtn}
                  activeOpacity={0.7}
                >
                  {isSavingBulk ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-sharp" size={15} color="#FFFFFF" />
                      <Text style={styles.headerSaveEditText}>Save</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : isSelectMode ? (
              <TouchableOpacity
                onPress={handleToggleSelectMode}
                style={styles.headerCancelEditBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.headerCancelEditText}>Cancel</Text>
              </TouchableOpacity>
            ) : items.length > 0 ? (
              <TouchableOpacity
                onPress={() => setShowHeaderActionsModal(true)}
                style={styles.headerThreeDotBtn}
                activeOpacity={0.7}
                accessibilityLabel="Menu options"
              >
                <Ionicons
                  name="ellipsis-vertical"
                  size={19}
                  color={colors.text}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* 1. Category Creation Form */}
        {isCreatingCategory && (
          <View style={styles.formCard}>
            <Text style={styles.cardKicker}>NEW CATEGORY</Text>
            <Text style={styles.formSubtitle}>
              It becomes a new tab on the counter. Keep it short — one or two words.
            </Text>

            <TextInput
              style={styles.formInput}
              placeholder="e.g. Milkshakes"
              placeholderTextColor={colors.textSecondary}
              value={categoryNameInput}
              onChangeText={setCategoryNameInput}
            />

            {/* Suggestions Chips */}
            <View style={styles.suggestionsRow}>
              {catSuggestions.slice(0, 3).map(sug => (
                <TouchableOpacity
                  key={sug}
                  onPress={() => setCategoryNameInput(sug)}
                  style={styles.suggestionChip}
                >
                  <Text style={styles.suggestionText}>{sug}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.existingCatsText}>
              Existing: {categories.map(c => c.name).join(' · ')}
            </Text>

            <View style={styles.formActionsRow}>
              <AppButton
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  Keyboard.dismiss();
                  setIsCreatingCategory(false);
                  setCategoryNameInput('');
                }}
                style={styles.cancelBtn}
              />
              <AppButton
                title="Create & add item"
                variant="primary"
                loading={isSavingCategory}
                disabled={isSavingCategory}
                onPress={handleSaveCategory}
                style={styles.createCatBtn}
              />
            </View>
          </View>
        )}

        {/* 2. Item Edit/Add Form */}
        {editingItem && (
          <View style={styles.editBlueprintCard}>
            <View style={styles.editTopRow}>
              {/* Photo Box with upload capability */}
              <TouchableOpacity
                onPress={handlePickItemPhoto}
                style={styles.photoBox}
                activeOpacity={0.8}
              >
                {itemPhotoUrl ? (
                  <Image
                    source={{ uri: itemPhotoUrl }}
                    style={styles.photoBoxImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.photoBoxEmpty}>
                    <DishVectorIcon
                      dishName={itemNameInput || editingItem.name}
                      categoryName={categories.find(c => c.id === selectedCatId)?.name}
                      overrideIconKey={selectedIconKey}
                      size={36}
                    />
                    <Text style={styles.photoBoxLabel}>Add Photo</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.editFields}>
                <Text style={styles.cardKicker}>
                  {editingItem.name ? 'EDIT ITEM' : 'NEW ITEM'}
                </Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Item name"
                  placeholderTextColor={colors.textSecondary}
                  value={itemNameInput}
                  onChangeText={setItemNameInput}
                />
                <View style={styles.priceRow}>
                  <TextInput
                    ref={fullPriceInputRef}
                    style={[styles.formInput, styles.priceField]}
                    placeholder="Full ₹"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={fullPriceInput}
                    onChangeText={t => setFullPriceInput(t.replace(/[^0-9]/g, ''))}
                  />
                  <TextInput
                    style={[styles.formInput, styles.priceField]}
                    placeholder="Half ₹"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={halfPriceInput}
                    onChangeText={t => setHalfPriceInput(t.replace(/[^0-9]/g, ''))}
                  />
                </View>
              </View>
            </View>

            {/* Category Select Chips (Horizontal Swipeable) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catChipsScroll}
            >
              {categories.map(c => {
                const isSelected = c.id === selectedCatId;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setSelectedCatId(c.id)}
                    style={[styles.catChip, isSelected && styles.catChipSelected]}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        isSelected && styles.catChipTextSelected,
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Phosphor Icon Picker */}
            <View style={styles.iconPickerSection}>
              <View style={styles.iconPickerHeader}>
                <Text style={styles.iconPickerTitle}>ITEM ICON</Text>
                <TouchableOpacity
                  onPress={() => setSelectedIconKey(null)}
                  style={styles.iconPickerAutoBtn}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.iconPickerAutoText, !selectedIconKey && styles.iconPickerAutoTextActive]}>
                    {!selectedIconKey ? 'Auto (from name) ✓' : 'Reset to Auto'}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.iconChipsScroll}
              >
                {AVAILABLE_PHOSPHOR_ICONS.map((opt) => {
                  const isSelected = selectedIconKey === opt.key;
                  const IconCmp = opt.IconComponent;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setSelectedIconKey(isSelected ? null : opt.key)}
                      style={[
                        styles.iconChip,
                        isSelected && styles.iconChipSelected,
                      ]}
                      activeOpacity={0.75}
                    >
                      <IconCmp
                        size={20}
                        weight="duotone"
                        color={isSelected ? '#FD5E03' : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.iconChipText,
                          isSelected && styles.iconChipTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {opt.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Toggles */}
            <View style={styles.togglesContainer}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsFav(!isFav)}
                style={styles.toggleRow}
              >
                <View style={styles.toggleInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={isFav ? "heart" : "heart-outline"} size={16} color={isFav ? "#EF4444" : colors.textSecondary} />
                    <Text style={styles.toggleTitle}>Favourite</Text>
                  </View>
                  <Text style={styles.toggleSub}>shows in the first tiles</Text>
                </View>
                <View style={[styles.toggleTrack, isFav && styles.toggleTrackActive]}>
                  <View
                    style={[styles.toggleKnob, isFav && styles.toggleKnobActive]}
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsAvailable(!isAvailable)}
                style={styles.toggleRow}
              >
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Available today</Text>
                  <Text style={styles.toggleSub}>
                    {isAvailable ? 'on the counter' : 'hidden as sold out'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.toggleTrack,
                    isAvailable && styles.toggleTrackActive,
                  ]}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      isAvailable && styles.toggleKnobActive,
                    ]}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.formActionsRow}>
              {editingItem && !editingItem.id.startsWith('new_') && !editingItem.id.startsWith('item_') && (
                <TouchableOpacity
                  onPress={() => handleDeleteItem(editingItem.id, itemNameInput || editingItem.name)}
                  style={styles.deleteFormBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  <Text numberOfLines={1} style={styles.deleteFormBtnText}>Delete</Text>
                </TouchableOpacity>
              )}
              <AppButton
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  Keyboard.dismiss();
                  setEditingItem(null);
                  setItemNameInput('');
                  setFullPriceInput('');
                  setHalfPriceInput('');
                  setItemPhotoUrl(null);
                }}
                style={styles.cancelBtn}
              />
              <AppButton
                title="Save Item"
                variant="primary"
                loading={isSavingItem}
                disabled={isSavingItem}
                onPress={handleSaveItem}
                style={styles.saveItemBtn}
              />
            </View>
          </View>
        )}

        {/* 3. Items List (When not editing) */}
        {!editingItem && !isCreatingCategory && (
          <View>
            {/* Top Primary Actions: Add Item & Import From Menu */}
            <View style={styles.topActionRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleStartNewItem}
                style={styles.topAddItemBtn}
              >
                <View style={styles.topAddItemIconWrap}>
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.topAddItemText} numberOfLines={1} adjustsFontSizeToFit>
                  Add Item
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowImportOptions(true)}
                style={styles.topImportBtn}
              >
                <View style={styles.topImportIconWrap}>
                  <Ionicons name="camera" size={16} color="#FF5F00" />
                </View>
                <Text style={styles.topImportText} numberOfLines={1} adjustsFontSizeToFit>
                  Import From Menu
                </Text>
              </TouchableOpacity>
            </View>

            {/* Category Filter & Manager Bar */}
            <View style={styles.categoryManagerContainer}>
              <View style={styles.categoryHeaderRow}>
                <Text style={styles.categoryHeaderTitle}>CATEGORIES</Text>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setIsCreatingCategory(true);
                    setCategoryNameInput('');
                  }}
                  style={styles.addCategoryHeaderBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addCategoryHeaderBtnText}>+ Add Category</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                <TouchableOpacity
                  onPress={() => setSelectedFilterCatId('all')}
                  style={[
                    styles.allFilterChip,
                    selectedFilterCatId === 'all' && styles.allFilterChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.catFilterText,
                      selectedFilterCatId === 'all' && styles.catFilterTextSelected,
                    ]}
                  >
                    All ({items.length})
                  </Text>
                </TouchableOpacity>

                {categories.map(c => {
                  const isSelected = selectedFilterCatId === c.id;
                  const catItemCount = items.filter(i => i.categoryId === c.id).length;
                  return (
                    <View
                      key={c.id}
                      style={[
                        styles.catFilterChipWrap,
                        isSelected && styles.catFilterChipWrapSelected,
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => setSelectedFilterCatId(c.id)}
                        style={styles.catFilterChip}
                      >
                        <Text
                          style={[
                            styles.catFilterText,
                            isSelected && styles.catFilterTextSelected,
                          ]}
                        >
                          {c.name} ({catItemCount})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedCategoryForMenu(c);
                          setIsCategoryMenuVisible(true);
                        }}
                        style={styles.catEditBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Category options"
                      >
                        <Ionicons
                          name="ellipsis-vertical"
                          size={14}
                          color={isSelected ? '#FFFFFF' : colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.hintBox}>
              <Ionicons name="options-outline" size={18} color="#FF5F00" />
              <Text style={styles.hintText}>
                Tap any item to edit details, or use the 3-dot menu at top to bulk edit prices or delete dishes.
              </Text>
            </View>

            <View style={styles.itemList}>
              {(() => {
                const displayedItems = selectedFilterCatId === 'all'
                  ? sortedItems
                  : sortedItems.filter(i => i.categoryId === selectedFilterCatId);

                return (
                  <>
                    {/* Bulk Selection Action Bar */}
                    {isSelectMode && (
                      <View style={styles.bulkActionBar}>
                        <TouchableOpacity
                          onPress={() => handleSelectAllVisibleItems(displayedItems)}
                          style={styles.bulkSelectAllBtn}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={selectedItemIds.size === displayedItems.length && displayedItems.length > 0 ? "checkbox" : "square-outline"}
                            size={20}
                            color={colors.accent}
                          />
                          <Text style={styles.bulkSelectAllText}>
                            {selectedItemIds.size === displayedItems.length && displayedItems.length > 0 ? 'Deselect All' : 'Select All'}
                          </Text>
                        </TouchableOpacity>

                        <View style={styles.bulkRightActions}>
                          <Text style={styles.bulkCountText}>
                            {selectedItemIds.size} of {displayedItems.length} selected
                          </Text>
                          <TouchableOpacity
                            onPress={handleDeleteSelectedItems}
                            disabled={selectedItemIds.size === 0 || isDeletingBatch}
                            style={[
                              styles.bulkDeleteBtn,
                              selectedItemIds.size === 0 && styles.bulkDeleteBtnDisabled,
                            ]}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
                            <Text style={styles.bulkDeleteBtnText}>
                              {isDeletingBatch ? 'Deleting...' : `Delete (${selectedItemIds.size})`}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Bulk Edit Banner */}
                    {isBulkEditMode && (
                      <View style={styles.bulkEditBanner}>
                        <View style={styles.bulkEditBannerLeft}>
                          <View style={styles.bulkEditIconBadge}>
                            <Ionicons name="options-outline" size={18} color="#FF5F00" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.bulkEditBannerTitle}>Bulk Price Editor Active</Text>
                            <Text style={styles.bulkEditBannerSub}>
                              Use − / + to step prices or type custom price directly
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {displayedItems.length === 0 ? (
                      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                        <Text style={{ fontSize: typography.sizes.body, color: colors.textMuted }}>
                          No items in this category yet.
                        </Text>
                      </View>
                    ) : (
                      displayedItems.map(item => {
                        const isSelected = selectedItemIds.has(item.id);
                        const catName =
                          categories.find(c => c.id === item.categoryId)?.name || '';
                        const currentEditedPrice = bulkEditMap[item.id]?.price ?? item.price;
                        const currentEditedHalf = bulkEditMap[item.id]?.halfPrice ?? (item.halfPrice || 0);

                        const subtext = `${catName}${
                          !isBulkEditMode && item.halfPrice ? ` — half ${formatRupee(item.halfPrice)}` : ''
                        }${!item.isAvailable ? ' — sold out' : ''}`;

                        return (
                          <View
                            key={item.id}
                            style={[
                              styles.itemRow,
                              !item.isAvailable && styles.itemRowDisabled,
                              isSelectMode && isSelected && styles.itemRowSelected,
                              isBulkEditMode && styles.itemRowBulkEdit,
                            ]}
                          >
                            {isSelectMode && (
                              <TouchableOpacity
                                onPress={() => handleToggleSelectItem(item.id)}
                                style={styles.rowSelectCheckbox}
                              >
                                <Ionicons
                                  name={isSelected ? "checkbox" : "square-outline"}
                                  size={22}
                                  color={isSelected ? colors.accent : colors.textMuted}
                                />
                              </TouchableOpacity>
                            )}

                            <DishVectorIcon
                              dishName={item.name}
                              categoryName={catName}
                              overrideIconKey={item.icon}
                              size={22}
                              showBadge={true}
                              style={{ marginRight: 10 }}
                            />

                            <TouchableOpacity
                              disabled={isBulkEditMode}
                              onPress={() => (isSelectMode ? handleToggleSelectItem(item.id) : handleStartEdit(item))}
                              style={styles.itemRowInfo}
                            >
                              <Text style={styles.itemRowName}>{item.name}</Text>
                              <Text style={styles.itemRowSub}>{subtext}</Text>
                            </TouchableOpacity>

                            {/* Normal / Select Mode Price & Fav */}
                            {!isBulkEditMode ? (
                              <>
                                {/* Price display: if price is 0, show Set Price pill! */}
                                {item.price > 0 ? (
                                  <Text style={styles.itemRowPrice}>
                                    {formatRupee(item.price)}
                                  </Text>
                                ) : (
                                  <TouchableOpacity
                                    onPress={() => (isSelectMode ? handleToggleSelectItem(item.id) : handleStartEdit(item))}
                                    style={styles.setPricePill}
                                    activeOpacity={0.8}
                                  >
                                    <Ionicons name="pricetag-outline" size={11} color="#FF5F00" />
                                    <Text style={styles.setPricePillText}>Set Price</Text>
                                  </TouchableOpacity>
                                )}

                                {!isSelectMode && (
                                  <TouchableOpacity
                                    onPress={() => handleToggleFavorite(item.id)}
                                    style={[
                                      styles.itemRowFavBtn,
                                      item.isFavorite && styles.itemRowFavBtnActive,
                                    ]}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons
                                      name={item.isFavorite ? 'heart' : 'heart-outline'}
                                      size={18}
                                      color={item.isFavorite ? '#EF4444' : colors.textMuted}
                                    />
                                    {item.isFavorite && (
                                      <Text style={styles.itemRowFavBadgeText}>FAV</Text>
                                    )}
                                  </TouchableOpacity>
                                )}
                              </>
                            ) : (
                              /* Bulk Edit Stepper Mode */
                              <View style={styles.bulkRowControls}>
                                <View style={styles.priceStepperWrap}>
                                  <TouchableOpacity
                                    onPress={() => handleStepPrice(item.id, 'price', -5)}
                                    style={styles.stepperBtn}
                                    activeOpacity={0.6}
                                  >
                                    <Ionicons name="remove" size={16} color={colors.text} />
                                  </TouchableOpacity>
                                  
                                  <View style={styles.stepperInputBox}>
                                    <Text style={styles.stepperCurrencyText}>₹</Text>
                                    <TextInput
                                      style={styles.stepperTextInput}
                                      keyboardType="number-pad"
                                      value={String(currentEditedPrice)}
                                      onChangeText={txt => handleDirectPriceChange(item.id, 'price', txt)}
                                      selectTextOnFocus
                                    />
                                  </View>

                                  <TouchableOpacity
                                    onPress={() => handleStepPrice(item.id, 'price', 5)}
                                    style={styles.stepperBtn}
                                    activeOpacity={0.6}
                                  >
                                    <Ionicons name="add" size={16} color={colors.text} />
                                  </TouchableOpacity>
                                </View>

                                {(item.hasHalf || (item.halfPrice && item.halfPrice > 0)) && (
                                  <View style={styles.halfStepperWrap}>
                                    <Text style={styles.halfStepperLabel}>Half:</Text>
                                    <TouchableOpacity
                                      onPress={() => handleStepPrice(item.id, 'halfPrice', -5)}
                                      style={styles.stepperBtnSmall}
                                      activeOpacity={0.6}
                                    >
                                      <Ionicons name="remove" size={12} color={colors.text} />
                                    </TouchableOpacity>
                                    <View style={styles.stepperInputBoxSmall}>
                                      <Text style={styles.stepperCurrencyTextSmall}>₹</Text>
                                      <TextInput
                                        style={styles.stepperTextInputSmall}
                                        keyboardType="number-pad"
                                        value={String(currentEditedHalf)}
                                        onChangeText={txt => handleDirectPriceChange(item.id, 'halfPrice', txt)}
                                        selectTextOnFocus
                                      />
                                    </View>
                                    <TouchableOpacity
                                      onPress={() => handleStepPrice(item.id, 'halfPrice', 5)}
                                      style={styles.stepperBtnSmall}
                                      activeOpacity={0.6}
                                    >
                                      <Ionicons name="add" size={12} color={colors.text} />
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </>
                );
              })()}
            </View>

            <Text style={styles.listFooterNote}>
              Add item drops into any existing category. Import from menu uses Counter365 AI to automatically extract your full printed menu in seconds.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* MODAL 1: Choose Import Source (Camera vs Gallery) */}
      <Modal
        visible={showImportOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImportOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.importModalCard}>
            <View style={styles.importModalHeader}>
              <Text style={styles.importModalTitle}>Import from menu</Text>
              <TouchableOpacity
                onPress={() => setShowImportOptions(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.importModalDesc}>
              Select how you want to capture your shop menu card:
            </Text>

            <View style={styles.importOptionButtons}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleScanMenuFromSource('camera')}
                style={styles.importOptionRow}
              >
                <View style={styles.importOptionIconBg}>
                  <Ionicons name="camera" size={20} color={colors.accent} />
                </View>
                <View style={styles.importOptionTexts}>
                  <Text style={styles.importOptionHeading}>Take photo with camera</Text>
                  <Text style={styles.importOptionSub}>Snap a clear photo of your printed menu</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleScanMenuFromSource('gallery')}
                style={styles.importOptionRow}
              >
                <View style={styles.importOptionIconBg}>
                  <Ionicons name="images" size={20} color={colors.accent} />
                </View>
                <View style={styles.importOptionTexts}>
                  <Text style={styles.importOptionHeading}>Choose from gallery</Text>
                  <Text style={styles.importOptionSub}>Pick a saved menu card image or photo</Text>
                </View>
              </TouchableOpacity>
            </View>

            <AppButton
              title="Cancel"
              variant="secondary"
              onPress={() => setShowImportOptions(false)}
              style={styles.modalCancelBtn}
            />
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Scanning Loader with HORIZONTAL Percentage Loading Bar */}
      <Modal visible={isScanningMenu} transparent animationType="fade">
        <View style={styles.loaderOverlay}>
          <View style={styles.horizontalLoaderCard}>
            <View style={styles.loaderHeaderRow}>
              <View style={styles.loaderIconBox}>
                <Ionicons name="sparkles" size={20} color={colors.accent} />
              </View>
              <View style={styles.loaderTitleBox}>
                <Text style={styles.horizontalLoaderTitle}>Extracting Menu</Text>
                <Text style={styles.horizontalLoaderSubtitle}>
                  Counter365 AI analyzing dishes & portions
                </Text>
              </View>
            </View>

            {/* Live Status and Big Percentage */}
            <View style={styles.progressInfoRow}>
              <Text style={styles.horizontalStageText} numberOfLines={1}>
                {scanStageText}
              </Text>
              <Text style={styles.horizontalPercentageText}>
                {Math.round(scanProgress)}%
              </Text>
            </View>

            {/* HORIZONTAL LOADING BAR */}
            <View style={styles.horizontalBarTrack}>
              <View
                style={[
                  styles.horizontalBarFill,
                  { width: `${Math.min(100, Math.max(0, scanProgress))}%` },
                ]}
              />
            </View>

            {/* Progress Stage Steps */}
            <View style={styles.progressStepsRow}>
              <Text style={[styles.progressStepDot, scanProgress >= 25 && styles.progressStepActive]}>
                ● Image
              </Text>
              <Text style={[styles.progressStepDot, scanProgress >= 58 && styles.progressStepActive]}>
                ● AI OCR
              </Text>
              <Text style={[styles.progressStepDot, scanProgress >= 85 && styles.progressStepActive]}>
                ● Photos
              </Text>
              <Text style={[styles.progressStepDot, scanProgress >= 100 && styles.progressStepActive]}>
                ● Ready
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Scanned Items Review & Confirmation */}
      <Modal
        visible={showScannedPreview}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScannedPreview(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalCard}>
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.previewTitle}>
                  Found {scannedItems.length} menu items
                </Text>
                <Text style={styles.previewSub}>
                  Select dishes to add to your counter menu:
                </Text>
              </View>
              <View style={styles.previewHeaderActions}>
                <TouchableOpacity
                  onPress={handleToggleSelectAllScanned}
                  style={styles.selectAllBtn}
                >
                  <Text style={styles.selectAllText}>
                    {scannedItems.every(it => it.selected) ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.scannedScroll} contentContainerStyle={styles.scannedList}>
              {scannedItems.map((item, idx) => {
                const isChecked = !!item.selected;

                return (
                  <TouchableOpacity
                    key={`${item.name}_${idx}`}
                    activeOpacity={0.8}
                    onPress={() => handleToggleScannedItem(idx)}
                    style={[styles.scannedItemCard, isChecked && styles.scannedItemChecked]}
                  >
                    <View style={[styles.checkboxBox, isChecked && styles.checkboxBoxActive]}>
                      {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                    </View>

                    <View style={styles.scannedItemIconBox}>
                      <DishVectorIcon
                        dishName={item.name}
                        categoryName={item.category}
                        size={24}
                        showBadge={true}
                      />
                    </View>

                    <View style={styles.scannedItemInfo}>
                      <Text style={styles.scannedItemName}>{item.name}</Text>
                      <View style={styles.scannedTagRow}>
                        <View style={styles.catBadge}>
                          <Text style={styles.catBadgeText}>{item.category}</Text>
                        </View>
                        {item.halfPrice && (
                          <Text style={styles.halfBadgeText}>
                            ½ {formatRupee(item.halfPrice)}
                          </Text>
                        )}
                      </View>
                    </View>

                    {item.price > 0 ? (
                      <Text style={styles.scannedPrice}>{formatRupee(item.price)}</Text>
                    ) : (
                      <View style={styles.unpricedBadge}>
                        <Text style={styles.unpricedBadgeText}>No price (Set later)</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.previewActions}>
              <AppButton
                title="Cancel"
                variant="secondary"
                onPress={() => setShowScannedPreview(false)}
                style={styles.previewCancelBtn}
              />
              <AppButton
                title={
                  isSavingScanned
                    ? 'Importing...'
                    : `Import (${scannedItems.filter(it => it.selected).length}) dishes`
                }
                variant="primary"
                onPress={handleInitiateImportScannedItems}
                disabled={isSavingScanned || scannedItems.filter(it => it.selected).length === 0}
                style={styles.previewAddBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Import Strategy (Add to existing vs Replace entire menu) */}
      <Modal
        visible={showImportStrategyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImportStrategyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.strategyModalCard}>
            <View style={styles.strategyIconCircle}>
              <Ionicons name="restaurant" size={28} color="#FF5F00" />
            </View>

            <Text style={styles.strategyTitle}>Import Menu Options</Text>
            <Text style={styles.strategyDesc}>
              You currently have <Text style={{ fontWeight: '700', color: colors.text }}>{items.length} dishes</Text> in your menu.
              How would you like to import these <Text style={{ fontWeight: '700', color: '#FF5F00' }}>{scannedItems.filter(it => it.selected).length} scanned items</Text>?
            </Text>

            <View style={styles.strategyButtonsCol}>
              {/* Option 1: Add to Existing */}
              <TouchableOpacity
                style={styles.strategyOptionCard}
                activeOpacity={0.8}
                onPress={() => handleConfirmImportScannedItems('add')}
              >
                <View style={[styles.strategyOptionIcon, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
                  <Ionicons name="add-circle" size={24} color="#16A34A" />
                </View>
                <View style={styles.strategyOptionTexts}>
                  <Text style={styles.strategyOptionTitle}>Add to Existing Menu</Text>
                  <Text style={styles.strategyOptionSub}>Keep all your current dishes and append the new items</Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: Replace Entire Menu */}
              <TouchableOpacity
                style={[styles.strategyOptionCard, styles.strategyOptionCardDanger]}
                activeOpacity={0.8}
                onPress={() => {
                  Alert.alert(
                    'Replace Entire Menu?',
                    `This will clear your ${items.length} existing dishes and categories, replacing them entirely with the ${scannedItems.filter(it => it.selected).length} scanned items.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Replace Menu',
                        style: 'destructive',
                        onPress: () => handleConfirmImportScannedItems('replace'),
                      },
                    ]
                  );
                }}
              >
                <View style={[styles.strategyOptionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Ionicons name="swap-horizontal" size={24} color="#DC2626" />
                </View>
                <View style={styles.strategyOptionTexts}>
                  <Text style={[styles.strategyOptionTitle, { color: '#DC2626' }]}>Replace Entire Menu</Text>
                  <Text style={styles.strategyOptionSub}>Clear preset/old items and only keep the newly imported menu</Text>
                </View>
              </TouchableOpacity>
            </View>

            <AppButton
              title="Cancel"
              variant="secondary"
              onPress={() => setShowImportStrategyModal(false)}
              style={styles.strategyCancelBtn}
            />
          </View>
        </View>
      </Modal>

      {/* Category Action Menu Modal (Three dots) */}
      <CategoryActionMenuModal
        visible={isCategoryMenuVisible}
        onClose={() => setIsCategoryMenuVisible(false)}
        category={selectedCategoryForMenu}
        itemCount={selectedCategoryForMenu ? items.filter(i => i.categoryId === selectedCategoryForMenu.id).length : 0}
        onEdit={(cat) => {
          handleStartEditCategory(cat);
        }}
        onDelete={(cat) => {
          handleDeleteCategory(cat);
        }}
      />

      {/* MODAL 4: Edit Category Input */}
      <Modal
        visible={editingCategory !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingCategory(null)}
      >
        <TouchableWithoutFeedback onPress={() => setEditingCategory(null)}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.catModalKeyboardWrap}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.catEditModalCard}>
                  {/* Header */}
                  <View style={styles.catModalHeader}>
                    <View style={styles.catModalHeaderIconCircle}>
                      <Ionicons name="pricetag" size={18} color={colors.accent700} />
                    </View>
                    <View style={styles.catModalHeaderTextWrap}>
                      <Text style={styles.catModalTitle}>Edit Category</Text>
                      {editingCategory && (
                        <Text style={styles.catModalSubtitle}>
                          {items.filter(i => i.categoryId === editingCategory.id).length} item(s) in this category
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => setEditingCategory(null)}
                      style={styles.modalCloseBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
                  >
                    {/* Input Block */}
                    <View style={styles.catInputBlock}>
                      <Text style={styles.catInputKicker}>CATEGORY NAME</Text>
                      <View style={styles.catInputWrap}>
                        <Ionicons name="folder-open-outline" size={18} color={colors.accent700} style={styles.catInputIcon} />
                        <TextInput
                          style={styles.catModalInput}
                          placeholder="e.g. Hot Drinks, Meals, Desserts"
                          placeholderTextColor={colors.textSecondary}
                          value={editCategoryNameInput}
                          onChangeText={setEditCategoryNameInput}
                          autoFocus
                        />
                      </View>
                    </View>

                    {/* Quick Category Suggestions */}
                    <View style={styles.catSuggestionsBlock}>
                      <Text style={styles.catSuggestionsLabel}>Quick presets:</Text>
                      <View style={styles.catSuggestionsList}>
                        {['Hot Drinks', 'Cold Drinks', 'Snacks', 'Meals', 'Combos', 'Desserts', 'Bakery'].map(preset => (
                          <TouchableOpacity
                            key={preset}
                            style={[
                              styles.catPresetChip,
                              editCategoryNameInput.trim().toLowerCase() === preset.toLowerCase() && styles.catPresetChipActive,
                            ]}
                            onPress={() => setEditCategoryNameInput(preset)}
                          >
                            <Text
                              style={[
                                styles.catPresetChipText,
                                editCategoryNameInput.trim().toLowerCase() === preset.toLowerCase() && styles.catPresetChipTextActive,
                              ]}
                            >
                              {preset}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Responsive Primary Action Row */}
                    <View style={styles.catModalPrimaryActions}>
                      <TouchableOpacity
                        onPress={() => setEditingCategory(null)}
                        style={styles.catModalCancelBtn}
                        activeOpacity={0.75}
                      >
                        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.catModalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleUpdateCategory}
                        style={styles.catModalUpdateBtn}
                        activeOpacity={0.8}
                      >
                        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.catModalUpdateText}>Update Category</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Separate, Safe Delete Action */}
                    <TouchableOpacity
                      onPress={() => editingCategory && handleDeleteCategory(editingCategory)}
                      style={styles.catModalDeleteRow}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={15} color="#DC2626" />
                      <Text style={styles.catModalDeleteRowText}>Delete this category</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* MODAL: Header 3-Dot Actions (Bulk Edit & Bulk Delete) */}
      <Modal
        visible={showHeaderActionsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHeaderActionsModal(false)}
      >
        <TouchableOpacity
          style={styles.menuActionsModalOverlay}
          activeOpacity={1}
          onPress={() => setShowHeaderActionsModal(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.menuActionsModalCard}>
              <View style={styles.menuActionsHeader}>
                <Text style={styles.menuActionsTitle}>Menu Actions</Text>
                <TouchableOpacity
                  onPress={() => setShowHeaderActionsModal(false)}
                  style={styles.menuActionsCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.menuActionItem}
                activeOpacity={0.7}
                onPress={() => {
                  setShowHeaderActionsModal(false);
                  handleStartBulkEdit();
                }}
              >
                <View style={[styles.menuActionIconBadge, { backgroundColor: 'rgba(255, 95, 0, 0.12)' }]}>
                  <Ionicons name="options-outline" size={20} color="#FF5F00" />
                </View>
                <View style={styles.menuActionTextWrap}>
                  <Text style={styles.menuActionLabel}>Edit Menu & Prices</Text>
                  <Text style={styles.menuActionSub}>
                    Bulk edit prices with stepper (+ / −) across all dishes
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.menuActionDivider} />

              <TouchableOpacity
                style={styles.menuActionItem}
                activeOpacity={0.7}
                onPress={() => {
                  setShowHeaderActionsModal(false);
                  handleToggleSelectMode();
                }}
              >
                <View style={[styles.menuActionIconBadge, { backgroundColor: 'rgba(220, 38, 38, 0.12)' }]}>
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                </View>
                <View style={styles.menuActionTextWrap}>
                  <Text style={[styles.menuActionLabel, { color: '#DC2626' }]}>Delete Items</Text>
                  <Text style={styles.menuActionSub}>
                    Select dishes to delete in bulk
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  const isDark = theme.isDark;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 140,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  backArrow: {
    fontSize: 18,
    color: colors.text,
  },
  title: {
    flex: 1,
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    color: colors.text,
    marginLeft: 12,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  itemCount: {
    marginLeft: 'auto',
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.heading,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardKicker: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 1.0,
    color: colors.accent,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  formSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    lineHeight: 16,
    marginBottom: 6,
  },
  formInput: {
    minHeight: 46,
    backgroundColor: colors.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 14,
    fontSize: 13.5,
    fontFamily: typography.fonts.body,
    color: colors.inputText,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 8,
  },
  suggestionChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    fontSize: 12,
    color: colors.text,
    fontFamily: typography.fonts.body,
  },
  existingCatsText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    fontFamily: typography.fonts.body,
  },
  topActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    width: '100%',
  },
  topAddItemBtn: {
    flex: 1,
    height: 50,
    backgroundColor: '#FF5F00',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 8,
    ...shadows.md,
  },
  topAddItemIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topAddItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: typography.fonts.heading,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  topImportBtn: {
    flex: 1.35,
    height: 50,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 8,
    ...shadows.sm,
  },
  topImportIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topImportText: {
    color: '#EA580C',
    fontSize: 13.5,
    fontFamily: typography.fonts.heading,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  itemRowFavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  itemRowFavBtnActive: {
    backgroundColor: '#FFF7ED',
  },
  itemRowFavBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF5F00',
    fontFamily: typography.fonts.heading,
  },
  formActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    minWidth: 76,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  createCatBtn: {
    flex: 1.4,
    height: 44,
    minWidth: 120,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  saveItemBtn: {
    flex: 1.4,
    height: 44,
    minWidth: 96,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  editBlueprintCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    ...shadows.card,
  },
  editTopRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoBox: {
    width: 62,
    height: 62,
    backgroundColor: colors.accent100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accent200,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBoxImage: {
    width: '100%',
    height: '100%',
  },
  photoBoxEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBoxEmoji: {
    fontSize: 20,
  },
  photoBoxLabel: {
    fontSize: 8.5,
    fontFamily: typography.fonts.heading,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '700',
  },
  editFields: {
    flex: 1,
    gap: 6,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priceField: {
    flex: 1,
  },
  catChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  catChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  catChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catChipSelected: {
    backgroundColor: theme.isDark ? colors.accent : '#111111',
    borderColor: theme.isDark ? colors.accent : '#111111',
  },
  catChipText: {
    fontSize: 12,
    color: colors.text,
  },
  catChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  togglesContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
    gap: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    color: colors.text,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  toggleSub: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  toggleTrack: {
    width: 40,
    height: 22,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 11,
    backgroundColor: 'transparent',
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(29, 31, 32, 0.35)',
  },
  toggleKnobActive: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-end',
  },
  hintBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.accent100,
    marginTop: 10,
    marginBottom: 12,
  },
  hintText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.accent,
    flex: 1,
    lineHeight: 17,
    fontFamily: typography.fonts.heading,
  },
  dragNote: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
    fontFamily: typography.fonts.body,
  },
  itemList: {
    gap: 8,
    borderTopWidth: 0,
    marginTop: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
    ...shadows.card,
  },
  itemRowDisabled: {
    opacity: 0.55,
  },
  itemListPhoto: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.accent100,
  },
  itemListIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.accent100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemListIconEmoji: {
    fontSize: 22,
  },
  itemRowInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemRowName: {
    fontSize: 14.5,
    color: colors.text,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  itemRowSub: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 1,
  },
  itemRowPrice: {
    fontFamily: typography.fonts.heading,
    fontSize: 15,
    color: colors.text,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  listBottomActions: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 14,
  },
  addItemBtn: {
    flex: 1.3,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  newCatBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
  },
  importFromMenuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent200,
    padding: 16,
    marginTop: 14,
    gap: 12,
    ...shadows.card,
  },
  importIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.accent100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importIconEmoji: {
    fontSize: 22,
  },
  importCardTexts: {
    flex: 1,
  },
  importCardTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 15,
    color: colors.text,
    fontWeight: '800',
  },
  importCardSub: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 2,
    lineHeight: 16,
  },
  importCardArrow: {
    fontSize: 18,
    color: colors.accent,
    fontWeight: '700',
  },
  listFooterNote: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: 10,
    fontFamily: typography.fonts.body,
    lineHeight: 16,
  },
  // Modal Overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay70,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  importModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 20,
    ...shadows.lg,
  },
  importModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  importModalTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h4,
    color: colors.text,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '700',
  },
  importModalDesc: {
    fontSize: typography.sizes.body,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginBottom: 16,
    lineHeight: 18,
  },
  importOptionButtons: {
    gap: 10,
    marginBottom: 16,
  },
  importOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.neutral100,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 12,
  },
  importOptionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importOptionIcon: {
    fontSize: 20,
  },
  importOptionTexts: {
    flex: 1,
  },
  importOptionHeading: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  importOptionSub: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: typography.fonts.body,
  },
  modalCancelBtn: {
    minHeight: 40,
  },
  // HORIZONTAL Loading Bar Modal
  loaderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  horizontalLoaderCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 22,
    width: '100%',
    maxWidth: 380,
    ...shadows.lg,
  },
  loaderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  loaderIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderIcon: {
    fontSize: 22,
  },
  loaderTitleBox: {
    flex: 1,
  },
  horizontalLoaderTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h4,
    color: colors.text,
  },
  horizontalLoaderSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 2,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  horizontalStageText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontFamily: typography.fonts.body,
    fontWeight: '600',
    marginRight: 8,
  },
  horizontalPercentageText: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.heading,
    color: '#FD5E03',
    fontWeight: '800',
  },
  horizontalBarTrack: {
    width: '100%',
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.neutral100,
    borderWidth: 1.5,
    borderColor: colors.divider,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  horizontalBarFill: {
    height: '100%',
    backgroundColor: '#FD5E03', // Official Counter365 brand orange progress fill
    borderRadius: 9,
  },
  progressStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.dividerLight,
  },
  progressStepDot: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  progressStepActive: {
    color: '#FD5E03',
    fontWeight: '700',
  },
  // Preview Scanned Items Modal
  previewModalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 18,
    ...shadows.lg,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerLight,
  },
  previewTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  previewSub: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: typography.fonts.body,
  },
  selectAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.neutral100,
    borderRadius: radii.sm,
  },
  selectAllText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.heading,
    color: colors.accent700,
  },
  scannedScroll: {
    maxHeight: 380,
  },
  scannedList: {
    gap: 8,
    paddingBottom: 8,
  },
  scannedItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.neutral100,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 10,
  },
  scannedItemChecked: {
    backgroundColor: colors.accent100,
    borderColor: colors.accent700,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxActive: {
    backgroundColor: colors.accent700,
    borderColor: colors.accent700,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 14,
  },
  scannedItemImg: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
  },
  scannedItemIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: '#F0F4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannedItemIconEmoji: {
    fontSize: 20,
  },
  scannedItemInfo: {
    flex: 1,
  },
  scannedItemName: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.body,
    color: colors.text,
  },
  scannedTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  catBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catBadgeText: {
    fontSize: 9,
    fontFamily: typography.fonts.heading,
    color: colors.textSecondary,
  },
  halfBadgeText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  photoContainerCol: {
    alignItems: 'center',
    gap: 6,
  },
  aiPhotoGenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFF4ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 28,
  },
  aiPhotoGenBtnText: {
    fontSize: 11,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: '#FD5E03',
  },
  previewHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batchAiGenTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF4ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  batchAiGenTriggerText: {
    fontSize: 10.5,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: '#FD5E03',
  },
  batchGeneratingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF4ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  batchGeneratingBannerText: {
    fontSize: 11,
    fontFamily: typography.fonts.body,
    fontWeight: '600',
    color: '#C2410C',
    flex: 1,
  },
  photoReadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  photoReadyBadgeText: {
    fontSize: 9.5,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: '#16A34A',
  },
  scannedPrice: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.dividerLight,
  },
  previewCancelBtn: {
    flex: 1,
    minHeight: 42,
  },
  previewAddBtn: {
    flex: 1.6,
    minHeight: 42,
  },
  deleteFormBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 44,
  },
  deleteFormBtnText: {
    color: '#DC2626',
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    fontWeight: '700',
  },
  itemRowDeleteBtn: {
    padding: 6,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryManagerContainer: {
    marginBottom: 12,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryHeaderTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
    letterSpacing: 1.1,
    color: colors.textMuted,
  },
  addCategoryHeaderBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  addCategoryHeaderBtnText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
    color: colors.accent,
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  allFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECE6',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 36,
  },
  allFilterChipSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  catFilterChipWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECE6',
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 6,
    minHeight: 36,
  },
  catFilterChipWrapSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  catFilterChip: {
    paddingVertical: 5,
    paddingRight: 4,
  },
  catFilterText: {
    fontFamily: typography.fonts.heading,
    fontSize: 12.5,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  catFilterTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  catEditBtn: {
    padding: 4,
  },
  catModalKeyboardWrap: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  catEditModalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 16,
    width: '100%',
    maxHeight: '88%',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.dividerLight,
    ...shadows.lg,
  },
  catModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catModalHeaderIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catModalHeaderTextWrap: {
    flex: 1,
  },
  catModalTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h5,
    color: colors.text,
  },
  catModalSubtitle: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.body,
    color: colors.textMuted,
    marginTop: 2,
  },
  catInputBlock: {
    gap: 6,
  },
  catInputKicker: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
    letterSpacing: 1.1,
    color: colors.textMuted,
  },
  catInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.accent200,
    borderRadius: radii.pill,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    height: 44,
  },
  catInputIcon: {
    marginRight: 8,
  },
  catModalInput: {
    flex: 1,
    height: '100%',
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.body,
    color: colors.inputText,
  },
  catSuggestionsBlock: {
    gap: 6,
  },
  catSuggestionsLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.body,
    color: colors.textMuted,
  },
  catSuggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catPresetChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catPresetChipActive: {
    backgroundColor: colors.accent100,
    borderColor: colors.accent,
  },
  catPresetChipText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.body,
    color: colors.text,
  },
  catPresetChipTextActive: {
    color: colors.accent,
    fontWeight: 'bold',
  },
  catModalPrimaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginTop: 12,
  },
  catModalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  catModalCancelText: {
    fontSize: 14,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: colors.text,
  },
  catModalUpdateBtn: {
    flex: 1.35,
    height: 46,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    ...shadows.sm,
  },
  catModalUpdateText: {
    fontSize: 14,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: '#FFFFFF',
  },
    catModalDeleteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      backgroundColor: 'rgba(220, 38, 38, 0.06)',
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: 'rgba(220, 38, 38, 0.2)',
    },
    catModalDeleteRowText: {
      color: '#DC2626',
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.xs,
    },
    headerRightGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 'auto',
      gap: 10,
    },
    headerThreeDotBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      borderRadius: radii.pill,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderWidth: 1,
      borderColor: colors.dividerLight,
    },
    headerCancelEditBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.pill,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      borderWidth: 1,
      borderColor: colors.dividerLight,
    },
    headerCancelEditText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    headerSaveEditBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.pill,
      backgroundColor: colors.accent,
    },
    headerSaveEditText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    menuActionsModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.48)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    menuActionsModalCard: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.dividerLight,
      ...shadows.lg,
    },
    menuActionsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.dividerLight,
    },
    menuActionsTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.base,
      fontWeight: '700',
      color: colors.text,
    },
    menuActionsCloseBtn: {
      padding: 4,
    },
    menuActionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: radii.md,
    },
    menuActionIconBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    menuActionTextWrap: {
      flex: 1,
      marginRight: 8,
    },
    menuActionLabel: {
      fontFamily: typography.fonts.heading,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    menuActionSub: {
      fontFamily: typography.fonts.body,
      fontSize: 11,
      color: colors.textMuted,
    },
    menuActionDivider: {
      height: 1,
      backgroundColor: colors.dividerLight,
      marginVertical: 4,
    },
    bulkEditBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(255, 95, 0, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255, 95, 0, 0.25)',
      borderRadius: radii.lg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
    },
    bulkEditBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    bulkEditIconBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 95, 0, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bulkEditBannerTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    bulkEditBannerSub: {
      fontFamily: typography.fonts.body,
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    itemRowBulkEdit: {
      paddingVertical: 8,
    },
    bulkRowControls: {
      alignItems: 'flex-end',
      gap: 6,
    },
    priceStepperWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
      paddingHorizontal: 2,
      paddingVertical: 2,
    },
    stepperBtn: {
      width: 28,
      height: 28,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      ...shadows.sm,
    },
    stepperInputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 52,
      paddingHorizontal: 4,
    },
    stepperCurrencyText: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
      marginRight: 1,
    },
    stepperTextInput: {
      fontFamily: typography.fonts.heading,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      minWidth: 32,
      paddingVertical: 0,
      paddingHorizontal: 2,
    },
    halfStepperWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    halfStepperLabel: {
      fontFamily: typography.fonts.body,
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: '600',
    },
    stepperBtnSmall: {
      width: 22,
      height: 22,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.dividerLight,
    },
    stepperInputBoxSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 40,
    },
    stepperCurrencyTextSmall: {
      fontFamily: typography.fonts.heading,
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
    },
    stepperTextInputSmall: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      minWidth: 24,
      paddingVertical: 0,
    },
    bulkActionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#F8F7F4',
      borderWidth: 1,
      borderColor: '#E8E5DF',
      borderRadius: radii.lg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 10,
    },
    bulkSelectAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    bulkSelectAllText: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    bulkRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bulkCountText: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: colors.textMuted,
    },
    bulkDeleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#DC2626',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: radii.pill,
    },
    bulkDeleteBtnDisabled: {
      opacity: 0.4,
    },
    bulkDeleteBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    rowSelectCheckbox: {
      marginRight: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemRowSelected: {
      backgroundColor: 'rgba(255, 95, 0, 0.06)',
      borderColor: colors.accent,
    },
    setPricePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255, 95, 0, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255, 95, 0, 0.3)',
      borderRadius: radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    setPricePillText: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      fontWeight: '700',
      color: '#FF5F00',
    },
    unpricedBadge: {
      backgroundColor: 'rgba(255, 95, 0, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255, 95, 0, 0.25)',
      borderRadius: radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    unpricedBadgeText: {
      fontFamily: typography.fonts.heading,
      fontSize: 10,
      fontWeight: '700',
      color: '#FF5F00',
    },
    strategyModalCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: 20,
      width: '100%',
      maxWidth: 420,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.dividerLight,
      ...shadows.lg,
    },
    strategyIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(255, 95, 0, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    strategyTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.h4,
      color: colors.text,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 6,
    },
    strategyDesc: {
      fontFamily: typography.fonts.body,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 18,
    },
    strategyButtonsCol: {
      width: '100%',
      gap: 10,
      marginBottom: 16,
    },
    strategyOptionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.isDark ? colors.surfaceSecondary : '#FAFAFA',
      borderWidth: 1.5,
      borderColor: theme.isDark ? colors.border : '#E8E5DF',
      borderRadius: radii.lg,
      padding: 12,
      gap: 12,
    },
    strategyOptionCardDanger: {
      borderColor: theme.isDark ? 'rgba(220, 38, 38, 0.4)' : 'rgba(220, 38, 38, 0.3)',
      backgroundColor: theme.isDark ? 'rgba(220, 38, 38, 0.12)' : 'rgba(220, 38, 38, 0.02)',
    },
    strategyOptionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    strategyOptionTexts: {
      flex: 1,
    },
    strategyOptionTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    strategyOptionSub: {
      fontFamily: typography.fonts.body,
      fontSize: 11.5,
      color: colors.textMuted,
      lineHeight: 15,
    },
    strategyCancelBtn: {
      width: '100%',
      height: 44,
      borderRadius: radii.pill,
    },
    // Phosphor Icon Picker Styles
    iconPickerSection: {
      marginTop: 10,
      marginBottom: 10,
    },
    iconPickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    iconPickerTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.textSecondary,
    },
    iconPickerAutoBtn: {
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    iconPickerAutoText: {
      fontFamily: typography.fonts.body,
      fontSize: 11,
      color: colors.textMuted,
    },
    iconPickerAutoTextActive: {
      color: '#FD5E03',
      fontWeight: '700',
    },
    iconChipsScroll: {
      gap: 8,
      paddingVertical: 2,
    },
    iconChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.pill,
      backgroundColor: theme.isDark ? colors.surfaceSecondary : '#F3F4F6',
      borderWidth: 1,
      borderColor: theme.isDark ? colors.border : '#E5E7EB',
    },
    iconChipSelected: {
      backgroundColor: theme.isDark ? 'rgba(253,94,3,0.18)' : '#FFF3EB',
      borderColor: '#FD5E03',
    },
    iconChipText: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    iconChipTextSelected: {
      color: '#FD5E03',
      fontWeight: '700',
    },
  });
};
