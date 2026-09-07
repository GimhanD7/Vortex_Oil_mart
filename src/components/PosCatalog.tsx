"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { ProductCategoryIcon } from "@/components/ProductCategoryIcon";

type CatalogProduct = {
  id: number;
  name: string;
  price: number;
  stock_quantity: number;
  category?: string;
  sub_category?: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  product_type?: string;
};

const PAGE_SIZE = 12;
const categoryName = (product: CatalogProduct) => product.category?.trim() || "Uncategorized";
const subcategoryName = (product: CatalogProduct) => product.sub_category?.trim() || "General";
const sorted = (values: string[]) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

export function PosCatalog<T extends CatalogProduct>({ products, onAdd, showIcons, onToggleIcons }: {
  products: T[];
  onAdd: (product: T) => void;
  showIcons: boolean;
  onToggleIcons: () => void;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const search = query.trim().toLowerCase();
  const categories = useMemo(() => sorted(products.map(categoryName)), [products]);
  const categoryProducts = useMemo(() => products.filter(p => categoryName(p) === category), [products, category]);
  const subcategories = useMemo(() => sorted(categoryProducts.map(subcategoryName)), [categoryProducts]);
  const filtered = useMemo(() => search
    ? products.filter(p => `${p.name} ${p.sku || ""} ${p.barcode || ""}`.toLowerCase().includes(search))
    : categoryProducts.filter(p => subcategoryName(p) === subcategory), [products, categoryProducts, subcategory, search]);
  const showProducts = Boolean(search || (category && subcategory));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount);
  const visible = filtered.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);

  function navigate(nextCategory: string | null, nextSubcategory: string | null = null) {
    setCategory(nextCategory);
    setSubcategory(nextSubcategory);
    setQuery("");
    setPage(1);
  }

  return (
    <div className="pos-catalog-browser">
      <div className="product-search">
        <Search className="catalog-icon" aria-hidden="true" />
        <input
          aria-label="Search products"
          value={query}
          onChange={event => { setQuery(event.target.value); setPage(1); }}
          onKeyDown={event => {
            if (event.key !== "Enter" || !search) return;
            const exact = products.filter(p => [p.sku, p.barcode].some(value => value?.toLowerCase() === search));
            if (exact.length === 1 && Number(exact[0].stock_quantity) > 0) {
              onAdd(exact[0]);
              setQuery("");
              setPage(1);
            }
          }}
          placeholder="Search or scan barcode, SKU, or product name"
        />
        {query && <button type="button" title="Clear search" aria-label="Clear search" onClick={() => { setQuery(""); setPage(1); }}><X size={18} /></button>}
      </div>

      <div className="pos-catalog-toolbar">
        <nav aria-label="Product categories" className="pos-catalog-path">
          <button type="button" onClick={() => navigate(null)} aria-current={!category && !search ? "page" : undefined}>Categories</button>
          {category && <><ChevronRight size={16} aria-hidden="true" /><button type="button" onClick={() => navigate(category)} aria-current={!subcategory && !search ? "page" : undefined}>{category}</button></>}
          {subcategory && <><ChevronRight size={16} aria-hidden="true" /><span>{subcategory}</span></>}
          {search && <><ChevronRight size={16} aria-hidden="true" /><span>Search results</span></>}
        </nav>
        <label className="pos-catalog-icon-setting"><input type="checkbox" checked={showIcons} onChange={onToggleIcons} /> Product icons</label>
      </div>

      <div className="pos-catalog-content" key={`${category}/${subcategory}/${search}/${activePage}`}>
        {!search && !category && <div className="pos-catalog-choices" aria-label="Categories">
          {categories.map(name => <button type="button" key={name} onClick={() => navigate(name)}>
            <ProductCategoryIcon category={name} className="catalog-icon" colored />
            <span>{name}</span>
            <small>{products.filter(p => categoryName(p) === name).length} items</small>
            <ChevronRight size={16} aria-hidden="true" />
          </button>)}
          {!categories.length && <p className="pos-catalog-empty">No products available.</p>}
        </div>}

        {!search && category && !subcategory && <div className="pos-catalog-choices" aria-label="Subcategories">
          {subcategories.map(name => <button type="button" key={name} onClick={() => navigate(category, name)}>
            <ProductCategoryIcon category={category} className="catalog-icon" colored />
            <span>{name}</span>
            <small>{categoryProducts.filter(p => subcategoryName(p) === name).length} items</small>
            <ChevronRight size={16} aria-hidden="true" />
          </button>)}
          {!subcategories.length && <p className="pos-catalog-empty">No products in this category.</p>}
        </div>}

        {showProducts && <div className={`pos-catalog-products${showIcons ? "" : " icons-hidden"}`} aria-label="Products">
          {visible.map(product => <button
            type="button"
            className="pos-catalog-product"
            key={product.id}
            disabled={Number(product.stock_quantity) <= 0}
            onClick={() => onAdd(product)}
            aria-label={`Add ${product.name} to cart`}
          >
            {showIcons && <ProductCategoryIcon category={product.category} productName={product.name} className="pos-product-icon" />}
            <b>{product.name}</b>
            <small>SKU: {product.sku}</small>
            <small>{Number(product.stock_quantity) <= 0 ? "Out of stock" : `Stock: ${Number(product.stock_quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })} ${product.unit || "Unit"}`}</small>
            <strong>Rs. {Number(product.price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{product.product_type === "loose_oil" ? " / L" : ""}</strong>
          </button>)}
          {!filtered.length && <p className="pos-catalog-empty">No matching products found.</p>}
        </div>}
      </div>

      {showProducts && <div className="pos-catalog-pagination">
        <span>{filtered.length ? (activePage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(activePage * PAGE_SIZE, filtered.length)} of {filtered.length} items</span>
        <button type="button" title="Previous products" aria-label="Previous products" disabled={activePage === 1} onClick={() => setPage(activePage - 1)}><ChevronLeft size={18} /></button>
        <span>{activePage} / {pageCount}</span>
        <button type="button" title="Next products" aria-label="Next products" disabled={activePage === pageCount} onClick={() => setPage(activePage + 1)}><ChevronRight size={18} /></button>
      </div>}
    </div>
  );
}
